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
