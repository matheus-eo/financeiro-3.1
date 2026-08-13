/** Auditoria de operações e falhas. */
function appendHistory_(tx, entry) {
  var timestamp = now_();
  var record = {
    ID: newId_('HIS'),
    Data: formatDate_(timestamp, 'yyyy-MM-dd'),
    Hora: formatDate_(timestamp, 'HH:mm:ss'),
    Usuário: getUserEmail_(),
    Operação: entry.operation || '',
    Tabela: entry.table || '',
    Registro: entry.recordId || '',
    'Valor Anterior': entry.previous === undefined ? '' : jsonForHistory_(entry.previous),
    'Valor Novo': entry.next === undefined ? '' : jsonForHistory_(entry.next),
    Resultado: entry.result || 'SUCESSO',
    Erro: entry.error || ''
  };
  appendRecord_(tx, FIN.SHEETS.HISTORY, record);
}

function appendFailureHistory_(operation, error) {
  try {
    var tx = new FinanceTransaction_();
    appendHistory_(tx, {
      operation: operation || 'Operação não identificada',
      table: '', recordId: '', previous: '', next: '',
      result: 'ERRO', error: error && error.message ? error.message : String(error)
    });
    tx.commit();
  } catch (historyError) {
    console.error('Não foi possível registrar falha: ' + historyError.message);
  }
}
