/** Criação não destrutiva da estrutura oficial do Google Sheets. */
function ensureSheetStructure_(name, headers, index, isView) {
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name, index);
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (!isView) {
    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    assert_(JSON.stringify(existingHeaders) === JSON.stringify(headers),
      'A aba ' + name + ' possui cabeçalhos diferentes da estrutura Financeiro 3.1. Nenhum dado foi alterado.');
  }
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#163A5F').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function setSheetWidths_(sheet, widths) {
  widths.forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
}

function seedInitialConfiguration_(tx) {
  var now = now_();
  var defaults = [
    [FIN.CONFIG_KEYS.CURRENT_MONTH, formatDate_(now, 'MM'), 'Mês exibido no Dashboard e Relatório WhatsApp.'],
    [FIN.CONFIG_KEYS.CURRENT_YEAR, formatDate_(now, 'yyyy'), 'Ano exibido no Dashboard e Relatório WhatsApp.'],
    [FIN.CONFIG_KEYS.CURRENCY, 'BRL', 'Moeda oficial.'],
    [FIN.CONFIG_KEYS.USER_NAME, '', 'Nome do usuário para referência.']
  ];
  defaults.forEach(function(item) {
    if (!getConfigRecord_(item[0])) setConfigValue_(tx, item[0], item[1], item[2]);
  });
}

function seedInitialCategories_(tx) {
  var existing = getSheetRows_(FIN.SHEETS.CATEGORIES).map(function(record) { return normalizeKey_(record.Categoria); });
  FIN.INITIAL_CATEGORIES.forEach(function(categoryName) {
    if (existing.indexOf(normalizeKey_(categoryName)) >= 0) return;
    appendRecord_(tx, FIN.SHEETS.CATEGORIES, {
      ID: newId_('CAT'), Categoria: categoryName, Ativa: FIN.YES,
      Observação: '', 'Criado Em': makeTimestamp_(), 'Atualizado Em': makeTimestamp_()
    });
  });
}

function configureNumberFormats_() {
  var currencyFormat = 'R$ #,##0.00;[Red]-R$ #,##0.00';
  var movement = getSheet_(FIN.SHEETS.MOVEMENTS);
  movement.getRange('J:J').setNumberFormat(currencyFormat);
  movement.getRange('K:K').setNumberFormat(currencyFormat);
  movement.getRange('L:L').setNumberFormat(currencyFormat);
  getSheet_(FIN.SHEETS.EXPENSE_CATALOG).getRange('E:E').setNumberFormat(currencyFormat);
  getSheet_(FIN.SHEETS.NET_WORTH).getRange('D:D').setNumberFormat(currencyFormat);
  getSheet_(FIN.SHEETS.REVENUES).getRange('F:F').setNumberFormat(currencyFormat);
  // Sem isso, o Google Sheets converte "AAAA-MM" em data ao regravar a linha
  // (Corrigir lançamento / Registrar pagamento), quebrando a comparação exata
  // usada em todo o sistema (movement.Competência === competence).
  movement.getRange('B:B').setNumberFormat('@');
  getSheet_(FIN.SHEETS.REVENUES).getRange('B:B').setNumberFormat('@');
}

function setupFinanceiro3_1() {
  var lock = getFinanceLock_();
  lock.waitLock(30000);
  try {
    var definitions = [
      [FIN.SHEETS.CONFIG, FIN.HEADERS.CONFIG, false],
      [FIN.SHEETS.REVENUES, FIN.HEADERS.REVENUES, true],
      [FIN.SHEETS.EXPENSE_CATALOG, FIN.HEADERS.EXPENSE_CATALOG, false],
      [FIN.SHEETS.MOVEMENTS, FIN.HEADERS.MOVEMENTS, false],
      [FIN.SHEETS.CATEGORIES, FIN.HEADERS.CATEGORIES, false],
      [FIN.SHEETS.NET_WORTH, FIN.HEADERS.NET_WORTH, false],
      [FIN.SHEETS.HISTORY, FIN.HEADERS.HISTORY, false],
      [FIN.SHEETS.DASHBOARD, ['Financeiro 3.1'], true],
      [FIN.SHEETS.REPORT, ['Relatório WhatsApp'], true]
    ];
    definitions.forEach(function(definition, index) {
      ensureSheetStructure_(definition[0], definition[1], index + 1, definition[2]);
    });
    setSheetWidths_(getSheet_(FIN.SHEETS.MOVEMENTS), [220, 95, 100, 125, 125, 210, 220, 190, 155, 120, 120, 110, 130, 135, 90, 135, 260, 155, 155]);
    setSheetWidths_(getSheet_(FIN.SHEETS.EXPENSE_CATALOG), [220, 220, 190, 155, 125, 135, 135, 100, 90, 250, 155, 155]);
    setSheetWidths_(getSheet_(FIN.SHEETS.HISTORY), [220, 100, 90, 220, 200, 180, 220, 260, 260, 100, 320]);
    configureNumberFormats_();
    var tx = new FinanceTransaction_();
    seedInitialConfiguration_(tx);
    seedInitialCategories_(tx);
    tx.commit();
    var viewTx = new FinanceTransaction_();
    refreshAllVisualizations_(viewTx);
    viewTx.commit();
    notifyUser_('Estrutura Financeiro 3.1 pronta. Crie o Formulário Inteligente pelo menu Financeiro 3.1.');
  } catch (error) {
    appendFailureHistory_('Configurar Financeiro 3.1', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}
