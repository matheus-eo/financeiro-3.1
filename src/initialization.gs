/**
 * Carga única, transacional e auditável do estado autorizado em 29/07/2026.
 * Execute somente depois de executar setupFinanceiro3_1().
 */
var INITIAL_JULY_2026 = {
  competence: '2026-07',
  snapshotDate: new Date(2026, 6, 29, 12, 0, 0),
  marker: 'CARGA_INICIAL_JULHO_2026',
  categories: ['Reserva Investimento', 'Saphira Nu', 'Limpeza Carro'],
  recurringExpenses: [
    { description: '📱 Telefone', category: 'Outras', planned: 80, dueDay: 5, actual: 36 },
    { description: '🌐 Internet', category: 'Outras', planned: 120, dueDay: 5, actual: 210 },
    { description: '🏠 Aluguel', category: 'Moradia', planned: 1000, dueDay: 15, actual: 800 },
    { description: '💧 Água', category: 'Moradia', planned: 100, dueDay: 16, actual: 1 },
    { description: '🏋️ Academia', category: 'Academia', planned: 185, dueDay: 21, actual: 185 },
    { description: '🎓 Escola Saphira', category: 'Educação', planned: 920, dueDay: 29, actual: 920 },
    { description: '🏐 Vôlei', category: 'Lazer', planned: 90, dueDay: 29, actual: 90 },
    { description: '📺 IPTV', category: 'Lazer', planned: 30, dueDay: 29, actual: 30 }
  ],
  cardBreakdown: [
    { category: 'Alimentação', planned: 1500, actual: 2056 },
    { category: 'Gasolina', planned: 700, actual: 879 },
    { category: 'Matheus', planned: 600, actual: 1480 },
    { category: 'Miranda', planned: 1000, actual: 1000 },
    { category: 'Academia', planned: 185, actual: 185 },
    { category: 'Reserva Investimento', planned: 100, actual: 100 },
    { category: 'Saphira Nu', planned: 100, actual: 100 },
    { category: 'Limpeza Carro', planned: 100, actual: 30 },
    { category: 'Spotify', planned: 32, actual: 32 }
  ],
  assets: [
    { description: 'Cofrinho MercadoPago', value: 98000 },
    { description: 'Fundo Imobiliário', value: 24000 },
    { description: 'Emergência', value: 10000 }
  ]
};

function dateJuly2026_(day) {
  return new Date(2026, 6, day, 12, 0, 0);
}

/**
 * Atualiza a base com a posição explicitamente informada em 03/08/2026.
 * Esta carga é distinta da carga inicial: preserva julho e cria somente os
 * eventos financeiros da competência de agosto. Os três pagamentos abaixo
 * foram autorizados de forma expressa pelo usuário.
 */
var INITIAL_AUGUST_2026 = {
  competence: '2026-08',
  snapshotDate: new Date(2026, 7, 3, 12, 0, 0),
  marker: 'CARGA_ATUALIZACAO_AGOSTO_2026',
  julyCardSettlementMarker: 'PAGAMENTO_FATURA_JULHO_2026_08_02',
  revenues: [
    { category: 'Matheus', description: '👨 Salário Matheus', value: 6000 },
    { category: 'Miranda', description: '👩 Salário Miranda', value: 1600 }
  ],
  cardBreakdown: [
    { category: 'Alimentação', planned: 1500, actual: 1053 },
    { category: 'Gasolina', planned: 700, actual: 0 },
    { category: 'Matheus', planned: 600, actual: 185 },
    { category: 'Miranda', planned: 1000, actual: 1000 },
    { category: 'Academia', planned: 185, actual: 185 },
    { category: 'Reserva Investimento', planned: 100, actual: 0 },
    { category: 'Saphira Nu', planned: 100, actual: 0 },
    { category: 'Limpeza Carro', planned: 100, actual: 0 },
    { category: 'Spotify', planned: 32, actual: 32 }
  ],
  explicitPayments: [
    { description: '📱 Telefone', value: 35, dueDay: 5 },
    { description: '🌐 Internet', value: 120, dueDay: 5 },
    { description: '🏋️ Academia', value: 185, dueDay: 21 }
  ],
  assets: [
    { description: 'Cofrinho MercadoPago', value: 93000 },
    { description: 'Fundo Imobiliário', value: 24000 },
    { description: 'Emergência', value: 10000 }
  ]
};

function dateAugust2026_(day) {
  return new Date(2026, 7, day, 12, 0, 0);
}

function ensureInitialLoadCategory_(tx, name) {
  var existing = findCategoryByName_(name);
  if (existing) return existing;
  var record = {
    ID: newId_('CAT'), Categoria: name, Ativa: FIN.YES,
    Observação: 'Categoria incluída pela carga inicial de julho de 2026.',
    'Criado Em': makeTimestamp_(), 'Atualizado Em': makeTimestamp_()
  };
  appendRecord_(tx, FIN.SHEETS.CATEGORIES, record);
  appendHistory_(tx, {
    operation: 'Carga inicial — cadastrar categoria', table: FIN.SHEETS.CATEGORIES,
    recordId: record.ID, next: record
  });
  return record;
}

function appendInitialExpenseCatalog_(tx, item) {
  var category = requireCategory_(item.category);
  var record = {
    ID: newId_('CAD'), Descrição: item.description,
    'Categoria ID': category.ID, Categoria: category.Categoria,
    'Valor Planejado': item.planned, 'Possui Vencimento': FIN.YES,
    'Dia do Vencimento': item.dueDay, Recorrente: FIN.YES, Ativa: FIN.YES,
    Observação: 'Cadastro incluído pela carga inicial de julho de 2026.',
    'Criado Em': makeTimestamp_(), 'Atualizado Em': makeTimestamp_()
  };
  appendRecord_(tx, FIN.SHEETS.EXPENSE_CATALOG, record);
  appendHistory_(tx, {
    operation: 'Carga inicial — cadastrar despesa', table: FIN.SHEETS.EXPENSE_CATALOG,
    recordId: record.ID, next: record
  });
  return record;
}

function appendInitialHistory_(tx, result) {
  appendHistory_(tx, result.history);
  return result.movement;
}

function loadInitialStateJuly2026() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    assert_(!getConfigRecord_(INITIAL_JULY_2026.marker),
      'A carga inicial de julho de 2026 já foi concluída ou está em andamento. Nenhum dado foi duplicado.');
    assert_(getSheetRows_(FIN.SHEETS.MOVEMENTS).length === 0 &&
      getSheetRows_(FIN.SHEETS.EXPENSE_CATALOG).length === 0 &&
      getSheetRows_(FIN.SHEETS.NET_WORTH).length === 0,
    'A carga inicial só pode ser executada em uma base financeira vazia. Nenhum dado foi alterado.');

    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_MONTH, '07', 'Competência da carga inicial autorizada.');
    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_YEAR, '2026', 'Competência da carga inicial autorizada.');
    INITIAL_JULY_2026.categories.forEach(function(category) { ensureInitialLoadCategory_(tx, category); });

    var catalogs = INITIAL_JULY_2026.recurringExpenses.map(function(item) {
      return { item: item, record: appendInitialExpenseCatalog_(tx, item) };
    });
    var generated = ensureRecurringForCompetence_(tx, INITIAL_JULY_2026.competence);
    generated.forEach(function(movement) {
      appendHistory_(tx, {
        operation: 'Carga inicial — gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS,
        recordId: movement.ID, next: movement
      });
    });

    appendInitialHistory_(tx, registerRevenue_(tx, {
      operation: FIN.OPERATIONS.REVENUE, competence: INITIAL_JULY_2026.competence,
      date: INITIAL_JULY_2026.snapshotDate, category: 'Matheus', description: '👨 Salário Matheus',
      value: 6000, note: 'Carga inicial autorizada em 29/07/2026.', origin: FIN.ORIGINS.SYSTEM
    }));
    appendInitialHistory_(tx, registerRevenue_(tx, {
      operation: FIN.OPERATIONS.REVENUE, competence: INITIAL_JULY_2026.competence,
      date: INITIAL_JULY_2026.snapshotDate, category: 'Miranda', description: '👩 Salário Miranda',
      value: 1600, note: 'Carga inicial autorizada em 29/07/2026.', origin: FIN.ORIGINS.SYSTEM
    }));

    INITIAL_JULY_2026.cardBreakdown.forEach(function(item) {
      appendInitialHistory_(tx, registerCardPurchase_(tx, {
        operation: FIN.OPERATIONS.CARD, competence: INITIAL_JULY_2026.competence,
        date: INITIAL_JULY_2026.snapshotDate, category: item.category,
        description: '💳 ' + item.category, value: item.actual, plannedValue: item.planned,
        note: 'Detalhamento do cartão da carga inicial em 29/07/2026.', origin: FIN.ORIGINS.SYSTEM
      }));
    });

    var cardMovement = appendInitialHistory_(tx, registerExpense_(tx, {
      operation: FIN.OPERATIONS.EXPENSE, competence: INITIAL_JULY_2026.competence,
      date: INITIAL_JULY_2026.snapshotDate, category: 'Outras', description: '💳 Cartão',
      movementType: FIN.TYPES.CARD_BILL,
      value: 5237, realizedValue: '', hasDueDate: FIN.YES, dueDate: new Date(2026, 7, 8, 12, 0, 0),
      note: 'Cartão pendente; o realizado é derivado exclusivamente do detalhamento do cartão.', origin: FIN.ORIGINS.SYSTEM
    }));

    catalogs.forEach(function(entry) {
      var movement = generated.filter(function(candidate) {
        return candidate['Cadastro Despesa ID'] === entry.record.ID;
      })[0];
      assert_(movement, 'Não foi possível gerar a movimentação inicial de ' + entry.item.description + '.');
      appendInitialHistory_(tx, registerPayment_(tx, {
        operation: FIN.OPERATIONS.PAYMENT, movementId: movement.ID,
        paymentDate: dateJuly2026_(entry.item.dueDay), paidValue: entry.item.actual,
        note: 'Pagamento explicitamente autorizado na carga inicial.'
      }));
    });

    appendInitialHistory_(tx, updateCardCurrent_(tx, {
      operation: FIN.OPERATIONS.CARD_CURRENT, competence: INITIAL_JULY_2026.competence,
      value: 4203, note: 'Valor manual informado para 29/07/2026.'
    }));

    INITIAL_JULY_2026.assets.forEach(function(asset) {
      appendInitialHistory_(tx, updateNetWorth_(tx, {
        operation: FIN.OPERATIONS.NET_WORTH, date: INITIAL_JULY_2026.snapshotDate,
        description: asset.description, value: asset.value,
        note: 'Patrimônio informado na carga inicial.', origin: FIN.ORIGINS.SYSTEM
      }));
    });

    setConfigValue_(tx, INITIAL_JULY_2026.marker, 'CONCLUÍDA',
      'Carga inicial autorizada em 29/07/2026; não executar novamente.');
    appendHistory_(tx, {
      operation: 'Carga inicial — concluir julho de 2026', table: FIN.SHEETS.CONFIG,
      recordId: INITIAL_JULY_2026.marker,
      next: { custoPlanejado: 7762, resultadoTeorico: -162, resultadoAtual: -534, cartaoAtual: 4203 }
    });

    refreshAllVisualizations_(tx);
    tx.commit();
    notifyUser_('Carga inicial de julho de 2026 concluída com sucesso.');
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Carga inicial — julho de 2026', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra a atualização autorizada em 03/08/2026 sem reconciliar números
 * manualmente, inferir pagamentos ou alterar a competência de julho.
 */
function loadAugust2026Update() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    assert_(getConfigRecord_(INITIAL_JULY_2026.marker),
      'A atualização de agosto exige a carga inicial de julho de 2026. Nenhum dado foi alterado.');
    assert_(!getConfigRecord_(INITIAL_AUGUST_2026.marker),
      'A atualização de agosto de 2026 já foi concluída ou está em andamento. Nenhum dado foi duplicado.');
    assert_(findRecords_(FIN.SHEETS.MOVEMENTS, function(movement) {
      return movement.Competência === INITIAL_AUGUST_2026.competence;
    }).length === 0,
    'Já existem movimentações de agosto de 2026. Use o Formulário Inteligente para complementar a competência.');

    var previousMonth = getConfigValue_(FIN.CONFIG_KEYS.CURRENT_MONTH, '');
    var previousYear = getConfigValue_(FIN.CONFIG_KEYS.CURRENT_YEAR, '');
    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_MONTH, '08', 'Competência exibida após a atualização de agosto de 2026.');
    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_YEAR, '2026', 'Competência exibida após a atualização de agosto de 2026.');
    appendHistory_(tx, {
      operation: 'Atualização de agosto — definir competência atual', table: FIN.SHEETS.CONFIG,
      recordId: FIN.CONFIG_KEYS.CURRENT_MONTH,
      previous: { mês: previousMonth, ano: previousYear }, next: { mês: '08', ano: '2026' }
    });

    var generated = ensureRecurringForCompetence_(tx, INITIAL_AUGUST_2026.competence);
    generated.forEach(function(movement) {
      appendHistory_(tx, {
        operation: 'Atualização de agosto — gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS,
        recordId: movement.ID, next: movement
      });
    });

    INITIAL_AUGUST_2026.revenues.forEach(function(revenue) {
      appendInitialHistory_(tx, registerRevenue_(tx, {
        operation: FIN.OPERATIONS.REVENUE, competence: INITIAL_AUGUST_2026.competence,
        date: INITIAL_AUGUST_2026.snapshotDate, category: revenue.category, description: revenue.description,
        value: revenue.value, note: 'Atualização autorizada em 03/08/2026.', origin: FIN.ORIGINS.SYSTEM
      }));
    });

    INITIAL_AUGUST_2026.cardBreakdown.forEach(function(item) {
      appendInitialHistory_(tx, registerCardPurchase_(tx, {
        operation: FIN.OPERATIONS.CARD, competence: INITIAL_AUGUST_2026.competence,
        date: INITIAL_AUGUST_2026.snapshotDate, category: item.category,
        description: '💳 ' + item.category, value: item.actual, plannedValue: item.planned,
        note: 'Detalhamento do cartão informado em 03/08/2026.', origin: FIN.ORIGINS.SYSTEM
      }));
    });

    appendInitialHistory_(tx, registerExpense_(tx, {
      operation: FIN.OPERATIONS.EXPENSE, competence: INITIAL_AUGUST_2026.competence,
      date: INITIAL_AUGUST_2026.snapshotDate, category: 'Outras', description: '💳 Cartão',
      movementType: FIN.TYPES.CARD_BILL,
      value: 5237, realizedValue: '', hasDueDate: FIN.YES, dueDate: new Date(2026, 8, 8, 12, 0, 0),
      note: 'Cartão pendente; o realizado é derivado exclusivamente do detalhamento do cartão.', origin: FIN.ORIGINS.SYSTEM
    }));

    settleAuthorizedJulyCardBill_(tx);

    INITIAL_AUGUST_2026.explicitPayments.forEach(function(payment) {
      var movement = generated.filter(function(candidate) {
        return candidate.Descrição === payment.description;
      })[0];
      assert_(movement, 'Não foi possível localizar a recorrência de agosto para ' + payment.description + '.');
      appendInitialHistory_(tx, registerPayment_(tx, {
        operation: FIN.OPERATIONS.PAYMENT, movementId: movement.ID,
        paymentDate: dateAugust2026_(payment.dueDay), paidValue: payment.value,
        note: 'Pagamento explicitamente autorizado pelo usuário na atualização de 03/08/2026.'
      }));
    });

    appendInitialHistory_(tx, updateCardCurrent_(tx, {
      operation: FIN.OPERATIONS.CARD_CURRENT, competence: INITIAL_AUGUST_2026.competence,
      value: 105, note: 'Valor manual informado para 03/08/2026.'
    }));

    INITIAL_AUGUST_2026.assets.forEach(function(asset) {
      appendInitialHistory_(tx, updateNetWorth_(tx, {
        operation: FIN.OPERATIONS.NET_WORTH, date: INITIAL_AUGUST_2026.snapshotDate,
        description: asset.description, value: asset.value,
        note: 'Patrimônio informado na atualização de agosto.', origin: FIN.ORIGINS.SYSTEM
      }));
    });

    setConfigValue_(tx, INITIAL_AUGUST_2026.marker, 'CONCLUÍDA',
      'Atualização autorizada em 03/08/2026; não executar novamente.');
    appendHistory_(tx, {
      operation: 'Atualização — concluir agosto de 2026', table: FIN.SHEETS.CONFIG,
      recordId: INITIAL_AUGUST_2026.marker,
      next: { custoPlanejado: 7762, resultadoTeorico: -162, resultadoAtual: 4805, cartaoAtual: 105 }
    });

    refreshAllVisualizations_(tx);
    tx.commit();
    notifyUser_('Atualização de agosto de 2026 concluída com sucesso.');
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Atualização — agosto de 2026', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra somente a quitação explicitamente autorizada da fatura de julho.
 * O tipo técnico FATURA_CARTAO impede que esta quitação duplique as compras
 * já contabilizadas pelo detalhamento gerencial do cartão.
 */
function settleAuthorizedJulyCardBill_(tx) {
  var marker = INITIAL_AUGUST_2026.julyCardSettlementMarker;
  assert_(!getConfigRecord_(marker), 'A quitação autorizada da fatura de julho já foi registrada.');
  var bill = findRecords_(FIN.SHEETS.MOVEMENTS, function(movement) {
    return movement.Competência === INITIAL_JULY_2026.competence && movement.Descrição === '💳 Cartão' &&
      (movement.Tipo === FIN.TYPES.CARD_BILL || movement.Tipo === FIN.TYPES.EXPENSE);
  })[0];
  assert_(bill, 'Fatura do cartão de julho de 2026 não encontrada. Nenhum pagamento foi registrado.');
  if (bill.Tipo !== FIN.TYPES.CARD_BILL) {
    var previousType = deepCopy_(bill);
    bill.Tipo = FIN.TYPES.CARD_BILL;
    bill['Atualizado Em'] = makeTimestamp_();
    updateRecord_(tx, FIN.SHEETS.MOVEMENTS, bill);
    appendHistory_(tx, {
      operation: 'Adequação técnica — identificar fatura do cartão', table: FIN.SHEETS.MOVEMENTS,
      recordId: bill.ID, previous: previousType, next: bill
    });
  }
  appendInitialHistory_(tx, registerPayment_(tx, {
    operation: FIN.OPERATIONS.PAYMENT, competence: INITIAL_JULY_2026.competence,
    movementId: bill.ID, paymentDate: new Date(2026, 7, 2, 12, 0, 0), paidValue: 5237,
    note: 'Pagamento total explicitamente confirmado pelo usuário em 02/08/2026. O detalhamento do cartão permanece exclusivamente gerencial.'
  }));
  setConfigValue_(tx, marker, 'CONCLUÍDA',
    'Fatura de julho de 2026 quitada em 02/08/2026 por confirmação explícita.');
  appendHistory_(tx, {
    operation: 'Registrar pagamento — fatura de julho', table: FIN.SHEETS.CONFIG,
    recordId: marker, next: { dataPagamento: '2026-08-02', valorPago: 5237 }
  });
}

/** Executa a migração de quitação em bases que já receberam agosto antes desta revisão. */
function applyAuthorizedJulyCardSettlement2026() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    assert_(getConfigRecord_(INITIAL_AUGUST_2026.marker),
      'A quitação da fatura de julho exige a atualização de agosto de 2026.');
    settleAuthorizedJulyCardBill_(tx);
    refreshAllVisualizations_(tx);
    tx.commit();
    notifyUser_('Fatura de julho quitada em 02/08/2026 e visualizações atualizadas.');
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Registrar pagamento — fatura de julho', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}
