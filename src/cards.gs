/** Processamento exclusivo do detalhamento e agregado do cartão. */
function getCardMovements_(competence) {
  return getSheetRows_(FIN.SHEETS.MOVEMENTS).filter(function(movement) {
    return movement.Competência === competence && movement.Tipo === FIN.TYPES.CARD_PURCHASE;
  });
}

function calculateCardExpenses_(competence) {
  return getCardMovements_(competence).reduce(function(total, movement) {
    return total + valueOrZero_(movement['Valor Realizado']);
  }, 0);
}

function getCardBreakdown_(competence) {
  var summary = {};
  getCardMovements_(competence).forEach(function(movement) {
    var category = movement.Categoria || 'Sem categoria';
    summary[category] = (summary[category] || 0) + valueOrZero_(movement['Valor Realizado']);
  });
  return summary;
}
