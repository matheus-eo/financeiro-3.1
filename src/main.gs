/** Pontos de entrada e operações de menu. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Financeiro 3.1')
    .addItem('Configurar estrutura', 'setupFinanceiro3_1')
    .addItem('Carregar estado inicial — julho de 2026', 'loadInitialStateJuly2026')
    .addItem('Carregar atualização — agosto de 2026', 'loadAugust2026Update')
    .addItem('Registrar quitação da fatura de julho', 'applyAuthorizedJulyCardSettlement2026')
    .addItem('Criar/atualizar Formulário Inteligente', 'createOrUpdateSmartForm')
    .addSeparator()
    .addItem('Gerar recorrências da competência atual', 'generateCurrentCompetence')
    .addItem('Reconstruir visualizações', 'rebuildSystem_')
    .addItem('Instalar manutenção diária', 'installDailyMaintenanceTrigger')
    .addToUi();
}

function generateCurrentCompetence() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    var generated = ensureRecurringForCompetence_(tx, getActiveCompetence_());
    generated.forEach(function(movement) {
      appendHistory_(tx, { operation: 'Gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS, recordId: movement.ID, next: movement });
    });
    refreshAllVisualizations_(tx);
    tx.commit();
    notifyUser_(generated.length + ' recorrência(s) gerada(s).');
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Gerar recorrências da competência atual', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

// Só leitura: mostra o que "Virar o mês" vai gerar, sem alterar nada.
function buildMonthRolloverPreview_() {
  var current = getActiveCompetence_();
  var next = nextCompetence_(current);
  var alreadyGenerated = {};
  getSheetRows_(FIN.SHEETS.MOVEMENTS).forEach(function(movement) {
    if (movement.Competência === next && movement['Cadastro Despesa ID']) {
      alreadyGenerated[movement['Cadastro Despesa ID']] = true;
    }
  });
  var items = findRecords_(FIN.SHEETS.EXPENSE_CATALOG, function(catalog) {
    return isAffirmative_(catalog.Recorrente) && isAffirmative_(catalog.Ativa);
  }).map(function(catalog) {
    var hasDueDate = isAffirmative_(catalog['Possui Vencimento']);
    var fromDue = hasDueDate ? dueDateForDay_(current, catalog['Dia do Vencimento']) : null;
    var toDue = hasDueDate ? dueDateForDay_(next, catalog['Dia do Vencimento']) : null;
    return {
      description: catalog.Descrição,
      plannedValue: valueOrZero_(catalog['Valor Planejado']),
      fromDueDate: fromDue ? formatDate_(fromDue, 'dd/MM/yyyy') : null,
      toDueDate: toDue ? formatDate_(toDue, 'dd/MM/yyyy') : null,
      alreadyGenerated: !!alreadyGenerated[catalog.ID]
    };
  });
  return { fromCompetence: current, toCompetence: next, items: items };
}

// Avança a competência ativa e gera as despesas fixas do novo mês.
function rolloverToNextCompetence_() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  var tx = new FinanceTransaction_();
  try {
    var current = getActiveCompetence_();
    var next = nextCompetence_(current);
    var parts = next.split('-');
    var previousMonth = getConfigValue_(FIN.CONFIG_KEYS.CURRENT_MONTH, '');
    var previousYear = getConfigValue_(FIN.CONFIG_KEYS.CURRENT_YEAR, '');
    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_MONTH, parts[1], 'Competência avançada por "Virar o mês".');
    setConfigValue_(tx, FIN.CONFIG_KEYS.CURRENT_YEAR, parts[0], 'Competência avançada por "Virar o mês".');
    appendHistory_(tx, {
      operation: 'Virar o mês — avançar competência', table: FIN.SHEETS.CONFIG,
      recordId: FIN.CONFIG_KEYS.CURRENT_MONTH,
      previous: { mês: previousMonth, ano: previousYear }, next: { mês: parts[1], ano: parts[0] }
    });
    var generated = ensureRecurringForCompetence_(tx, next);
    generated.forEach(function(movement) {
      appendHistory_(tx, {
        operation: 'Virar o mês — gerar despesa recorrente', table: FIN.SHEETS.MOVEMENTS,
        recordId: movement.ID, next: movement
      });
    });
    refreshAllVisualizations_(tx);
    tx.commit();
    return { fromCompetence: current, toCompetence: next, generated: generated.length };
  } catch (error) {
    tx.rollback();
    appendFailureHistory_('Virar o mês', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function dailyMaintenance() {
  rebuildSystem_();
}

function installDailyMaintenanceTrigger() {
  ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'dailyMaintenance';
  }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(6).create();
  notifyUser_('Manutenção diária instalada.');
}
