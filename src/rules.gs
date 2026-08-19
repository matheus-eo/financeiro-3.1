/** RN-001 a RN-014 e coordenação transacional. */
function executeFinancialCommand_(command) {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    validateBaseCommand_(command);
    if (command.competence && [
      FIN.OPERATIONS.REVENUE,
      FIN.OPERATIONS.EXPENSE,
      FIN.OPERATIONS.CARD,
      FIN.OPERATIONS.PLANNED_VALUE
    ].indexOf(command.operation) >= 0) {
      ensureRecurringForCompetence_(tx, requireCompetence_(command.competence)).forEach(function(movement) {
        appendHistory_(tx, {
          operation: 'Gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS,
          recordId: movement.ID, next: movement
        });
      });
    }
    var result = applyCommand_(tx, command);
    refreshAllVisualizations_(tx);
    appendHistory_(tx, result.history);
    tx.commit();
    return result;
  } catch (error) {
    tx.rollback();
    appendFailureHistory_(command && command.operation, error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function applyCommand_(tx, command) {
  switch (command.operation) {
    case FIN.OPERATIONS.REVENUE: return registerRevenue_(tx, command);
    case FIN.OPERATIONS.EXPENSE: return registerExpense_(tx, command);
    case FIN.OPERATIONS.CARD: return registerCardPurchase_(tx, command);
    case FIN.OPERATIONS.PAYMENT: return registerPayment_(tx, command);
    case FIN.OPERATIONS.CARD_CURRENT: return updateCardCurrent_(tx, command);
    case FIN.OPERATIONS.NET_WORTH: return updateNetWorth_(tx, command);
    case FIN.OPERATIONS.CORRECTION: return correctMovement_(tx, command);
    case FIN.OPERATIONS.PLANNED_VALUE: return updatePlannedValue_(tx, command);
    case FIN.OPERATIONS.DELETE: return deleteMovement_(tx, command);
    default: throw new Error('Operação sem regra de processamento: ' + command.operation);
  }
}

function baseMovement_(command, type, category) {
  var timestamp = makeTimestamp_();
  return {
    ID: newId_('MOV'),
    Competência: command.competence,
    Data: command.date,
    Tipo: type,
    Origem: command.origin || FIN.ORIGINS.FORM,
    'Cadastro Despesa ID': command.expenseCatalogId || '',
    Descrição: command.description,
    'Categoria ID': category ? category.ID : '',
    Categoria: category ? category.Categoria : '',
    'Valor Planejado': command.plannedValue === undefined ? '' : command.plannedValue,
    'Valor Realizado': command.realizedValue === undefined ? '' : command.realizedValue,
    'Valor Pago': command.paidValue === undefined ? '' : command.paidValue,
    'Possui Vencimento': command.hasDueDate || FIN.NO,
    'Data de Vencimento': command.dueDate || '',
    Pago: command.paid || FIN.NO,
    'Data do Pagamento': command.paymentDate || '',
    Observação: command.note || '',
    'Criado Em': timestamp,
    'Atualizado Em': timestamp
  };
}

function ensureRecurringForCompetence_(tx, competence) {
  var existing = getSheetRows_(FIN.SHEETS.MOVEMENTS);
  var generated = [];
  findRecords_(FIN.SHEETS.EXPENSE_CATALOG, function(catalog) {
    return isAffirmative_(catalog.Recorrente) && isAffirmative_(catalog.Ativa);
  }).forEach(function(catalog) {
    var found = existing.some(function(movement) {
      return movement.Competência === competence && movement['Cadastro Despesa ID'] === catalog.ID;
    });
    if (found) return;
    var hasDueDate = catalog['Possui Vencimento'];
    var dueDate = isAffirmative_(hasDueDate) ? dueDateForDay_(competence, catalog['Dia do Vencimento']) : '';
    var movement = baseMovement_({
      competence: competence,
      date: now_(),
      description: catalog.Descrição,
      expenseCatalogId: catalog.ID,
      plannedValue: requireAmount_(catalog['Valor Planejado'], 'Valor planejado do cadastro'),
      realizedValue: '',
      hasDueDate: hasDueDate,
      dueDate: dueDate,
      paid: FIN.NO,
      note: catalog.Observação,
      origin: FIN.ORIGINS.RECURRENCE
    }, FIN.TYPES.EXPENSE, { ID: catalog['Categoria ID'], Categoria: catalog.Categoria });
    appendRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
    existing.push(movement);
    generated.push(movement);
  });
  return generated;
}

function registerRevenue_(tx, command) {
  command.competence = requireCompetence_(command.competence);
  command.date = requireDate_(command.date, 'Data');
  command.description = requireText_(command.description, 'Descrição');
  command.realizedValue = requireAmount_(command.value, 'Valor');
  var category = requireCategory_(command.category);
  var movement = baseMovement_(command, FIN.TYPES.REVENUE, category);
  movement.Pago = FIN.NOT_APPLICABLE;
  movement['Possui Vencimento'] = FIN.NO;
  appendRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
  return { movement: movement, history: { operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, next: movement } };
}

function registerExpense_(tx, command) {
  command.competence = requireCompetence_(command.competence);
  command.date = requireDate_(command.date, 'Data');
  command.description = requireText_(command.description, 'Descrição');
  command.plannedValue = requireAmount_(command.value, 'Valor');
  command.realizedValue = command.realizedValue === undefined
    ? command.plannedValue
    : (command.realizedValue === '' || command.realizedValue === null
      ? ''
      : requireAmount_(command.realizedValue, 'Valor realizado'));
  command.hasDueDate = command.hasDueDate || FIN.NO;
  command.dueDate = validateDueDate_(command.hasDueDate, command.dueDate);
  var category = requireCategory_(command.category);
  var movementType = command.movementType || FIN.TYPES.EXPENSE;
  assert_(movementType === FIN.TYPES.EXPENSE || movementType === FIN.TYPES.CARD_BILL,
    'Tipo de despesa não permitido.');
  var movement = baseMovement_(command, movementType, category);
  appendRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
  return { movement: movement, history: { operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, next: movement } };
}

function registerCardPurchase_(tx, command) {
  command.competence = requireCompetence_(command.competence);
  command.date = requireDate_(command.date, 'Data');
  command.description = command.description || 'Compra no cartão';
  command.realizedValue = requireAmount_(command.value, 'Valor');
  command.plannedValue = command.plannedValue === undefined
    ? 0
    : requireAmount_(command.plannedValue, 'Valor planejado do cartão');
  command.hasDueDate = FIN.NO;
  var category = requireCategory_(command.category);
  var movement = baseMovement_(command, FIN.TYPES.CARD_PURCHASE, category);
  appendRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
  return { movement: movement, history: { operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, next: movement } };
}

function registerPayment_(tx, command) {
  var id = extractSelectionId_(requireText_(command.movementId, 'Despesa'));
  var movement = findRecordById_(FIN.SHEETS.MOVEMENTS, id);
  assert_(movement, 'Movimentação não encontrada: ' + id + '.');
  assert_(isPayableExpense_(movement), 'Somente despesas ou faturas do cartão podem receber confirmação de pagamento.');
  if (command.competence) {
    assert_(movement.Competência === requireCompetence_(command.competence),
      'A despesa selecionada não pertence à competência informada.');
  }
  assert_(!isPaymentConfirmed_(movement.Pago), 'A despesa já está marcada como paga.');
  var previous = deepCopy_(movement);
  var paymentDate = requireDate_(command.paymentDate, 'Data do pagamento');
  var suppliedPaidValue = optionalAmount_(command.paidValue, 'Valor pago');
  var existingRealized = asNumber_(movement['Valor Realizado']);
  var plannedValue = valueOrZero_(movement['Valor Planejado']);
  var paidValue = suppliedPaidValue === null ? (existingRealized === null ? plannedValue : existingRealized) : suppliedPaidValue;

  movement.Pago = FIN.YES;
  movement['Data do Pagamento'] = paymentDate;
  movement['Valor Pago'] = paidValue;
  if (suppliedPaidValue !== null || existingRealized === null) movement['Valor Realizado'] = paidValue;
  movement.Observação = command.note || movement.Observação;
  movement['Atualizado Em'] = makeTimestamp_();
  updateRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
  return { movement: movement, history: { operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, previous: previous, next: movement } };
}

function updateCardCurrent_(tx, command) {
  var competence = requireCompetence_(command.competence);
  var amount = requireAmount_(command.value, 'Novo valor do Cartão Atual');
  var previous = getCardCurrent_(competence);
  setCardCurrent_(tx, competence, amount);
  return { history: { operation: command.operation, table: FIN.SHEETS.CONFIG, recordId: FIN.CARD_CURRENT_PREFIX + competence, previous: { value: previous }, next: { value: amount, note: command.note || '' } } };
}

function updateNetWorth_(tx, command) {
  command.date = requireDate_(command.date, 'Data');
  command.description = requireText_(command.description, 'Descrição');
  var amount = requireAmount_(command.value, 'Valor');
  var record = {
    ID: newId_('PAT'),
    'Ativo ID': getOrCreateAssetId_(command.description),
    Descrição: command.description,
    Valor: amount,
    Data: command.date,
    Observação: command.note || '',
    Origem: command.origin || FIN.ORIGINS.FORM,
    'Registrado Em': makeTimestamp_()
  };
  appendRecord_(tx, FIN.SHEETS.NET_WORTH, record);
  return { history: { operation: command.operation, table: FIN.SHEETS.NET_WORTH, recordId: record.ID, next: record } };
}

function correctMovement_(tx, command) {
  var id = extractSelectionId_(requireText_(command.movementId, 'Registro'));
  var movement = findRecordById_(FIN.SHEETS.MOVEMENTS, id);
  assert_(movement, 'Movimentação não encontrada: ' + id + '.');
  var field = requireText_(command.field, 'Campo');
  validateCorrectionField_(field);
  var previous = deepCopy_(movement);
  var newValue = command.newValue;
  if (field === 'Categoria') {
    var category = requireCategory_(newValue);
    movement['Categoria ID'] = category.ID;
    movement.Categoria = category.Categoria;
  } else if (field === 'Valor Planejado' || field === 'Valor Realizado') {
    movement[field] = requireAmount_(newValue, field);
  } else if (field === 'Possui Vencimento') {
    assert_(newValue === FIN.YES || newValue === FIN.NO, 'Possui Vencimento deve ser Sim ou Não.');
    movement[field] = newValue;
    if (newValue === FIN.NO) movement['Data de Vencimento'] = '';
  } else if (field === 'Data de Vencimento' || field === 'Data') {
    movement[field] = requireDate_(newValue, field);
  } else if (field === 'Competência') {
    movement[field] = requireCompetence_(newValue);
  } else {
    movement[field] = requireText_(newValue, field);
  }
  if (field === 'Data de Vencimento') movement['Possui Vencimento'] = FIN.YES;
  assert_(!valuesEqual_(previous[field], movement[field]) || field === 'Categoria', 'A correção não alterou o valor informado.');
  movement.Observação = (movement.Observação ? movement.Observação + ' | ' : '') + 'Correção: ' + requireText_(command.reason, 'Motivo');
  movement['Atualizado Em'] = makeTimestamp_();
  updateRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
  return { movement: movement, history: { operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, previous: previous, next: movement } };
}

function deleteMovement_(tx, command) {
  var id = extractSelectionId_(requireText_(command.movementId, 'Registro'));
  var movement = findRecordById_(FIN.SHEETS.MOVEMENTS, id);
  assert_(movement, 'Movimentação não encontrada: ' + id + '.');
  var reason = requireText_(command.reason, 'Motivo');
  tx.deleteRow(getSheet_(FIN.SHEETS.MOVEMENTS), movement.__row);
  return {
    history: {
      operation: command.operation, table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID,
      previous: movement, next: { excluído: true, motivo: reason }
    }
  };
}

// Ajusta o planejado da categoria inteira do cartão: o lançamento mais
// recente da categoria vira o "portador" do total informado, e o planejado
// dos demais é zerado — assim a soma do Detalhamento do Cartão nunca
// desencontra do valor que o usuário definiu para a categoria.
function setCardCategoryPlanned_(tx, competence, category, amount, reason) {
  var movements = findRecords_(FIN.SHEETS.MOVEMENTS, function(m) {
    return m.Competência === competence && m.Tipo === FIN.TYPES.CARD_PURCHASE && normalizeKey_(m.Categoria) === normalizeKey_(category);
  });
  assert_(movements.length > 0, 'Nenhuma compra no cartão encontrada para a categoria ' + category + ' nesta competência.');
  movements.sort(function(a, b) { return new Date(b['Criado Em']).getTime() - new Date(a['Criado Em']).getTime(); });
  movements.forEach(function(movement, index) {
    var previous = deepCopy_(movement);
    movement['Valor Planejado'] = index === 0 ? amount : 0;
    movement.Observação = (movement.Observação ? movement.Observação + ' | ' : '') + 'Correção: ' + reason;
    movement['Atualizado Em'] = makeTimestamp_();
    updateRecord_(tx, FIN.SHEETS.MOVEMENTS, movement);
    appendHistory_(tx, {
      operation: 'Ajustar valor planejado (categoria do cartão)', table: FIN.SHEETS.MOVEMENTS,
      recordId: movement.ID, previous: previous, next: movement
    });
  });
}

function updatePlannedValue_(tx, command) {
  var competence = requireCompetence_(command.competence);
  var catalogId = extractSelectionId_(requireText_(command.expenseCatalogId, 'Despesa'));
  var catalog = findExpenseCatalogById_(catalogId);
  assert_(catalog, 'Cadastro de despesa não encontrado: ' + catalogId + '.');
  var amount = requireAmount_(command.value, 'Novo valor planejado');
  var previousCatalog = deepCopy_(catalog);
  catalog['Valor Planejado'] = amount;
  catalog['Atualizado Em'] = makeTimestamp_();
  updateRecord_(tx, FIN.SHEETS.EXPENSE_CATALOG, catalog);

  var matchingMovement = findRecords_(FIN.SHEETS.MOVEMENTS, function(movement) {
    return movement.Competência === competence && movement['Cadastro Despesa ID'] === catalog.ID && movement.Tipo === FIN.TYPES.EXPENSE;
  })[0];
  if (matchingMovement && !isPaymentConfirmed_(matchingMovement.Pago) && asNumber_(matchingMovement['Valor Realizado']) === null) {
    matchingMovement['Valor Planejado'] = amount;
    matchingMovement['Atualizado Em'] = makeTimestamp_();
    updateRecord_(tx, FIN.SHEETS.MOVEMENTS, matchingMovement);
  }
  return { history: { operation: command.operation, table: FIN.SHEETS.EXPENSE_CATALOG, recordId: catalog.ID, previous: previousCatalog, next: catalog } };
}

function rebuildSystem_() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    ensureRecurringForCompetence_(tx, getActiveCompetence_()).forEach(function(movement) {
      appendHistory_(tx, {
        operation: 'Gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS,
        recordId: movement.ID, next: movement
      });
    });
    refreshAllVisualizations_(tx);
    tx.commit();
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Reconstruir visualizações', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}
