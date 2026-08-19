function now_() {
  return new Date();
}

function formatDate_(value, pattern) {
  return Utilities.formatDate(new Date(value), FIN.TIMEZONE, pattern || 'yyyy-MM-dd');
}

function currentCompetence_() {
  return formatDate_(now_(), 'yyyy-MM');
}

function isValidCompetence_(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeText_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeKey_(value) {
  return normalizeText_(value).toLocaleUpperCase('pt-BR');
}

function asNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  var text = String(value).trim().replace(/\s/g, '');
  var lastComma = text.lastIndexOf(',');
  var lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    text = text.replace(',', '.');
  }
  var parsed = Number(text);
  return isFinite(parsed) ? parsed : null;
}

function isAffirmative_(value) {
  return normalizeKey_(value) === normalizeKey_(FIN.YES);
}

function isPaymentConfirmed_(value) {
  return isAffirmative_(value);
}

function toBooleanLabel_(value) {
  return value ? FIN.YES : FIN.NO;
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid();
}

function makeTimestamp_() {
  return formatDate_(now_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function sameCompetence_(date, competence) {
  return formatDate_(date, 'yyyy-MM') === competence;
}

function monthEndDate_(competence) {
  var parts = competence.split('-');
  return new Date(Number(parts[0]), Number(parts[1]), 0);
}

function nextCompetence_(competence) {
  var parts = competence.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]) + 1;
  if (month > 12) { month = 1; year += 1; }
  return String(year) + '-' + String(month).padStart(2, '0');
}

function dueDateForDay_(competence, day) {
  var numericDay = Number(day);
  var end = monthEndDate_(competence);
  var safeDay = Math.min(Math.max(1, numericDay), end.getDate());
  var parts = competence.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, safeDay);
}

function datesEqual_(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return formatDate_(left) === formatDate_(right);
}

function valuesEqual_(left, right) {
  if (left instanceof Date || right instanceof Date) return datesEqual_(left, right);
  return String(left === null || left === undefined ? '' : left) === String(right === null || right === undefined ? '' : right);
}

function deepCopy_(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonForHistory_(value) {
  return typeof value === 'string' ? value : JSON.stringify(value || {});
}

function displayMoney_(value) {
  var number = asNumber_(value) || 0;
  return 'R$ ' + number.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function getUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || 'Usuário não identificado';
  } catch (error) {
    return 'Usuário não identificado';
  }
}

/** Usa bloqueio do documento quando vinculado e do projeto em implantação independente. */
function getFinanceLock_() {
  return LockService.getDocumentLock() || LockService.getScriptLock();
}

/** Exibe retorno em projeto vinculado e registra a mensagem em execução independente. */
function notifyUser_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}
