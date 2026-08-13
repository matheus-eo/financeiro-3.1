/** Validação de comandos antes de qualquer persistência. */
function assert_(condition, message) {
  if (!condition) throw new Error(message);
}

function requireText_(value, label) {
  var normalized = normalizeText_(value);
  assert_(normalized !== '', 'Campo obrigatório: ' + label + '.');
  return normalized;
}

function requireCompetence_(value) {
  var competence = requireText_(value, 'Competência');
  assert_(isValidCompetence_(competence), 'Competência inválida. Utilize o formato AAAA-MM.');
  return competence;
}

function requireAmount_(value, label) {
  var amount = asNumber_(value);
  assert_(amount !== null && amount >= 0, (label || 'Valor') + ' deve ser numérico e maior ou igual a zero.');
  return amount;
}

function optionalAmount_(value, label) {
  if (value === '' || value === null || value === undefined) return null;
  return requireAmount_(value, label);
}

function requireDate_(value, label) {
  assert_(value instanceof Date && !isNaN(value.getTime()), 'Data inválida: ' + label + '.');
  return value;
}

function requireCategory_(categoryName) {
  var category = findCategoryByName_(requireText_(categoryName, 'Categoria'));
  assert_(category, 'Categoria inexistente ou inativa: ' + categoryName + '.');
  return category;
}

function validateDueDate_(hasDueDate, dueDate) {
  if (isAffirmative_(hasDueDate)) return requireDate_(dueDate, 'Data de vencimento');
  assert_(!dueDate, 'Uma despesa sem vencimento não pode receber data de vencimento.');
  return null;
}

function validateBaseCommand_(command) {
  assert_(command && command.operation, 'Operação não informada.');
  assert_(Object.keys(FIN.OPERATIONS).some(function(key) {
    return FIN.OPERATIONS[key] === command.operation;
  }), 'Operação inválida: ' + command.operation + '.');
}

function extractSelectionId_(value) {
  var selected = normalizeText_(value);
  var match = selected.match(/^([A-Z]+-[0-9a-f-]{36})\b/i);
  return match ? match[1] : selected;
}

function validateCorrectionField_(field) {
  assert_(FIN.EDITABLE_CORRECTION_FIELDS.indexOf(field) >= 0,
    'Campo não permitido para correção: ' + field + '. Use Registrar pagamento para alterar o estado de pagamento.');
}
