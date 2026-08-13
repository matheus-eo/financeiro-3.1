/** Formulário Inteligente: coleta dados, sem aplicar regras de negócio. */
function addRequiredText_(form, title) {
  return form.addTextItem().setTitle(title).setRequired(true);
}

function addRequiredDate_(form, title) {
  return form.addDateItem().setTitle(title).setRequired(true);
}

function addCategoryItem_(form) {
  var choices = getActiveCategories_().map(function(category) { return category.Categoria; });
  assert_(choices.length > 0, 'Não há categorias ativas para o formulário.');
  return form.addListItem().setTitle('Categoria').setChoiceValues(choices).setRequired(true);
}

function addCompetenceItem_(form) {
  return addRequiredText_(form, 'Competência (AAAA-MM)');
}

function expenseMovementChoices_() {
  return getSheetRows_(FIN.SHEETS.MOVEMENTS).filter(function(movement) {
    return isPayableExpense_(movement) && !isPaymentConfirmed_(movement.Pago);
  }).map(function(movement) {
    return movement.ID + ' — [' + movement.Competência + '] ' + movement.Descrição;
  });
}

function expenseCatalogChoices_() {
  return findRecords_(FIN.SHEETS.EXPENSE_CATALOG, function(record) { return isAffirmative_(record.Ativa); })
    .map(function(record) { return record.ID + ' — ' + record.Descrição; });
}

function addSubmitSection_(page) {
  page.setGoToPage(FormApp.PageNavigationType.SUBMIT);
}

function rebuildSmartForm_(form) {
  form.getItems().slice().reverse().forEach(function(item) { form.deleteItem(item); });
  form.setTitle('Financeiro 3.1 — Formulário Inteligente');
  form.setDescription('Registre um evento financeiro. O formulário coleta; as regras são aplicadas pelo Apps Script.');
  form.setConfirmationMessage('Registro recebido e enviado para processamento.');

  var chooser = form.addListItem().setTitle('O que você deseja fazer?').setRequired(true);
  var sections = {};

  sections[FIN.OPERATIONS.REVENUE] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.REVENUE);
  addRequiredDate_(form, 'Data'); addCompetenceItem_(form); addCategoryItem_(form);
  addRequiredText_(form, 'Descrição'); addRequiredText_(form, 'Valor'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.REVENUE]);

  sections[FIN.OPERATIONS.EXPENSE] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.EXPENSE);
  addRequiredDate_(form, 'Data'); addCompetenceItem_(form); addCategoryItem_(form);
  addRequiredText_(form, 'Descrição'); addRequiredText_(form, 'Valor');
  form.addMultipleChoiceItem().setTitle('Possui vencimento').setChoiceValues([FIN.YES, FIN.NO]).setRequired(true);
  form.addDateItem().setTitle('Data de vencimento'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.EXPENSE]);

  sections[FIN.OPERATIONS.CARD] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.CARD);
  addRequiredDate_(form, 'Data'); addCompetenceItem_(form); addCategoryItem_(form);
  addRequiredText_(form, 'Valor'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.CARD]);

  sections[FIN.OPERATIONS.PAYMENT] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.PAYMENT);
  addCompetenceItem_(form);
  var paymentChoices = expenseMovementChoices_();
  form.addListItem().setTitle('Selecionar despesa').setChoiceValues(paymentChoices.length ? paymentChoices : ['SEM DESPESAS PENDENTES']).setRequired(true);
  addRequiredDate_(form, 'Data do pagamento'); form.addTextItem().setTitle('Valor pago (opcional)'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.PAYMENT]);

  sections[FIN.OPERATIONS.CARD_CURRENT] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.CARD_CURRENT);
  addCompetenceItem_(form); addRequiredText_(form, 'Novo valor do Cartão Atual'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.CARD_CURRENT]);

  sections[FIN.OPERATIONS.NET_WORTH] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.NET_WORTH);
  addRequiredDate_(form, 'Data'); addRequiredText_(form, 'Descrição'); addRequiredText_(form, 'Valor'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.NET_WORTH]);

  sections[FIN.OPERATIONS.CORRECTION] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.CORRECTION);
  addCompetenceItem_(form);
  var allMovements = getSheetRows_(FIN.SHEETS.MOVEMENTS).map(function(movement) { return movement.ID + ' — [' + movement.Competência + '] ' + movement.Descrição; });
  form.addListItem().setTitle('Registro').setChoiceValues(allMovements.length ? allMovements : ['SEM MOVIMENTAÇÕES']).setRequired(true);
  form.addListItem().setTitle('Campo').setChoiceValues(FIN.EDITABLE_CORRECTION_FIELDS).setRequired(true);
  addRequiredText_(form, 'Novo valor'); addRequiredText_(form, 'Motivo'); addSubmitSection_(sections[FIN.OPERATIONS.CORRECTION]);

  sections[FIN.OPERATIONS.PLANNED_VALUE] = form.addPageBreakItem().setTitle(FIN.OPERATIONS.PLANNED_VALUE);
  addCompetenceItem_(form);
  var catalogChoices = expenseCatalogChoices_();
  form.addListItem().setTitle('Despesa').setChoiceValues(catalogChoices.length ? catalogChoices : ['SEM CADASTROS ATIVOS']).setRequired(true);
  addRequiredText_(form, 'Novo valor planejado'); form.addParagraphTextItem().setTitle('Observação'); addSubmitSection_(sections[FIN.OPERATIONS.PLANNED_VALUE]);

  chooser.setChoices(Object.keys(sections).map(function(operation) {
    return chooser.createChoice(operation, sections[operation]);
  }));
}

function createOrUpdateSmartForm() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  try {
    var formId = getConfigValue_(FIN.CONFIG_KEYS.FORM_ID, '');
    var form = formId ? FormApp.openById(formId) : FormApp.create('Financeiro 3.1 — Formulário Inteligente');
    rebuildSmartForm_(form);
    var tx = new FinanceTransaction_();
    setConfigValue_(tx, FIN.CONFIG_KEYS.FORM_ID, form.getId(), 'Identificador técnico do Formulário Inteligente.');
    setConfigValue_(tx, FIN.CONFIG_KEYS.FORM_URL, form.getPublishedUrl(), 'Link de preenchimento do Formulário Inteligente.');
    appendHistory_(tx, { operation: 'Criar/atualizar Formulário Inteligente', table: 'Google Forms', recordId: form.getId(), next: { url: form.getPublishedUrl() } });
    tx.commit();
    ScriptApp.getProjectTriggers().filter(function(trigger) {
      return trigger.getHandlerFunction() === 'onSmartFormSubmit';
    }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
    ScriptApp.newTrigger('onSmartFormSubmit').forForm(form).onFormSubmit().create();
    notifyUser_('Formulário pronto: ' + form.getPublishedUrl());
  } catch (error) {
    appendFailureHistory_('Criar/atualizar Formulário Inteligente', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function formResponseToMap_(response) {
  return response.getItemResponses().reduce(function(map, itemResponse) {
    map[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
    return map;
  }, {});
}

function formResponseToCommand_(response) {
  var fields = formResponseToMap_(response);
  var operation = fields['O que você deseja fazer?'];
  var base = { operation: operation, note: fields.Observação || '' };
  if (operation === FIN.OPERATIONS.REVENUE || operation === FIN.OPERATIONS.EXPENSE) {
    base.date = fields.Data; base.competence = fields['Competência (AAAA-MM)']; base.category = fields.Categoria;
    base.description = fields.Descrição; base.value = fields.Valor;
    if (operation === FIN.OPERATIONS.EXPENSE) { base.hasDueDate = fields['Possui vencimento']; base.dueDate = fields['Data de vencimento'] || null; }
  } else if (operation === FIN.OPERATIONS.CARD) {
    base.date = fields.Data; base.competence = fields['Competência (AAAA-MM)']; base.category = fields.Categoria; base.value = fields.Valor;
  } else if (operation === FIN.OPERATIONS.PAYMENT) {
    base.competence = fields['Competência (AAAA-MM)']; base.movementId = fields['Selecionar despesa']; base.paymentDate = fields['Data do pagamento']; base.paidValue = fields['Valor pago (opcional)'];
  } else if (operation === FIN.OPERATIONS.CARD_CURRENT) {
    base.competence = fields['Competência (AAAA-MM)']; base.value = fields['Novo valor do Cartão Atual'];
  } else if (operation === FIN.OPERATIONS.NET_WORTH) {
    base.date = fields.Data; base.description = fields.Descrição; base.value = fields.Valor;
  } else if (operation === FIN.OPERATIONS.CORRECTION) {
    base.competence = fields['Competência (AAAA-MM)']; base.movementId = fields.Registro; base.field = fields.Campo; base.newValue = fields['Novo valor']; base.reason = fields.Motivo;
  } else if (operation === FIN.OPERATIONS.PLANNED_VALUE) {
    base.competence = fields['Competência (AAAA-MM)']; base.expenseCatalogId = fields.Despesa; base.value = fields['Novo valor planejado'];
  }
  return base;
}

function onSmartFormSubmit(event) {
  executeFinancialCommand_(formResponseToCommand_(event.response));
}
