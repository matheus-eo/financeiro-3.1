/** Acesso centralizado à única fonte de dados do sistema. */
function getSpreadsheet_() {
  var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) return activeSpreadsheet;
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('FINANCEIRO_SPREADSHEET_ID');
  assert_(spreadsheetId,
    'Projeto Apps Script sem planilha configurada. Defina FINANCEIRO_SPREADSHEET_ID nas Propriedades do Script.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Aba obrigatória não encontrada: ' + name);
  return sheet;
}

function getSheetRows_(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn === 0) return [];
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.filter(function(row) {
    return row.some(function(cell) { return cell !== '' && cell !== null; });
  }).map(function(row, index) {
    var record = { __row: index + 2 };
    headers.forEach(function(header, column) { record[header] = row[column]; });
    return record;
  });
}

function getHeaderIndex_(sheetName) {
  var headers = getSheet_(sheetName).getRange(1, 1, 1, getSheet_(sheetName).getLastColumn()).getValues()[0];
  return headers.reduce(function(map, header, index) {
    map[header] = index + 1;
    return map;
  }, {});
}

function recordToRow_(sheetName, record) {
  var headers = getSheet_(sheetName).getRange(1, 1, 1, getSheet_(sheetName).getLastColumn()).getValues()[0];
  return headers.map(function(header) {
    return record[header] === undefined || record[header] === null ? '' : record[header];
  });
}

function findRecordById_(sheetName, id) {
  var record = getSheetRows_(sheetName).filter(function(row) { return row.ID === id; })[0];
  return record || null;
}

function findRecords_(sheetName, predicate) {
  return getSheetRows_(sheetName).filter(predicate);
}

function appendRecord_(tx, sheetName, record) {
  var sheet = getSheet_(sheetName);
  var row = recordToRow_(sheetName, record);
  return tx.appendRow(sheet, row);
}

function updateRecord_(tx, sheetName, record) {
  if (!record || !record.__row) throw new Error('Registro sem linha de origem para atualização em ' + sheetName);
  var sheet = getSheet_(sheetName);
  tx.setRow(sheet, record.__row, recordToRow_(sheetName, record));
  return record;
}

function getConfigRecord_(name) {
  var records = findRecords_(FIN.SHEETS.CONFIG, function(record) { return record.Nome === name; });
  return records.length ? records[records.length - 1] : null;
}

function getConfigValue_(name, fallback) {
  var record = getConfigRecord_(name);
  return record ? record.Valor : fallback;
}

function setConfigValue_(tx, name, value, description) {
  var record = getConfigRecord_(name);
  var timestamp = makeTimestamp_();
  if (record) {
    record.Valor = value;
    record.Descrição = description || record.Descrição;
    record['Atualizado Em'] = timestamp;
    updateRecord_(tx, FIN.SHEETS.CONFIG, record);
    return record;
  }
  record = {
    ID: newId_('CFG'), Nome: name, Valor: value,
    Descrição: description || '', 'Atualizado Em': timestamp
  };
  appendRecord_(tx, FIN.SHEETS.CONFIG, record);
  return record;
}

function getActiveCategories_() {
  return findRecords_(FIN.SHEETS.CATEGORIES, function(record) {
    return isAffirmative_(record.Ativa);
  });
}

function findCategoryByName_(name) {
  var key = normalizeKey_(name);
  return getActiveCategories_().filter(function(record) {
    return normalizeKey_(record.Categoria) === key;
  })[0] || null;
}

function findExpenseCatalogById_(id) {
  return findRecordById_(FIN.SHEETS.EXPENSE_CATALOG, id);
}

function getCardCurrent_(competence) {
  return asNumber_(getConfigValue_(FIN.CARD_CURRENT_PREFIX + competence, 0)) || 0;
}

function setCardCurrent_(tx, competence, amount) {
  return setConfigValue_(tx, FIN.CARD_CURRENT_PREFIX + competence, amount,
    'Cartão Atual informado manualmente para a competência ' + competence + '.');
}

function getCurrentAssetPositions_() {
  var latest = {};
  getSheetRows_(FIN.SHEETS.NET_WORTH).forEach(function(record) {
    var key = record['Ativo ID'];
    if (!key) return;
    var previous = latest[key];
    if (!previous || new Date(record['Registrado Em']).getTime() >= new Date(previous['Registrado Em']).getTime()) {
      latest[key] = record;
    }
  });
  return Object.keys(latest).map(function(key) { return latest[key]; });
}

function getOrCreateAssetId_(description) {
  var key = normalizeKey_(description);
  var previous = getSheetRows_(FIN.SHEETS.NET_WORTH).filter(function(record) {
    return normalizeKey_(record.Descrição) === key;
  });
  return previous.length ? previous[previous.length - 1]['Ativo ID'] : newId_('ATV');
}

function FinanceTransaction_() {
  this.undoActions_ = [];
  this.finished_ = false;
}

FinanceTransaction_.prototype.appendRow = function(sheet, values) {
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  this.undoActions_.push(function() { sheet.deleteRow(row); });
  return row;
};

FinanceTransaction_.prototype.setRow = function(sheet, rowNumber, values) {
  var previous = sheet.getRange(rowNumber, 1, 1, values.length).getValues()[0];
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  this.undoActions_.push(function() { sheet.getRange(rowNumber, 1, 1, previous.length).setValues([previous]); });
};

FinanceTransaction_.prototype.deleteRow = function(sheet, rowNumber) {
  var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.deleteRow(rowNumber);
  this.undoActions_.push(function() {
    sheet.insertRowBefore(rowNumber);
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  });
};

FinanceTransaction_.prototype.replaceView = function(sheet, values) {
  var oldRows = Math.max(sheet.getLastRow(), 1);
  var oldColumns = Math.max(sheet.getLastColumn(), 1);
  var newRows = Math.max(values.length, 1);
  var newColumns = Math.max(values[0] ? values[0].length : 1, 1);
  var rows = Math.max(oldRows, newRows);
  var columns = Math.max(oldColumns, newColumns);
  var range = sheet.getRange(1, 1, rows, columns);
  var previous = range.getValues();
  range.clearContent();
  if (values.length) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  this.undoActions_.push(function() {
    range.clearContent();
    sheet.getRange(1, 1, previous.length, previous[0].length).setValues(previous);
  });
};

FinanceTransaction_.prototype.commit = function() {
  this.finished_ = true;
  this.undoActions_ = [];
};

FinanceTransaction_.prototype.rollback = function() {
  if (this.finished_) return;
  for (var i = this.undoActions_.length - 1; i >= 0; i -= 1) {
    try { this.undoActions_[i](); } catch (rollbackError) { console.error(rollbackError); }
  }
  this.finished_ = true;
};
