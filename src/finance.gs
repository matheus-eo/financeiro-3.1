/** Cálculos financeiros puros. Nenhuma função altera estados. */
function valueOrZero_(value) {
  var number = asNumber_(value);
  return number === null ? 0 : number;
}

function calculateSemaphore_(movement, referenceDate) {
  if (isPaymentConfirmed_(movement.Pago)) return FIN.SEMAPHORE.GREEN;
  if (!isAffirmative_(movement['Possui Vencimento']) || !movement['Data de Vencimento']) return FIN.SEMAPHORE.NONE;
  var due = new Date(movement['Data de Vencimento']);
  due.setHours(0, 0, 0, 0);
  var today = new Date(referenceDate || now_());
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime() ? FIN.SEMAPHORE.RED : FIN.SEMAPHORE.YELLOW;
}

function getLaunches_(movements, referenceDate) {
  return movements.filter(function(movement) {
    return isPayableExpense_(movement) &&
      isAffirmative_(movement['Possui Vencimento']) &&
      !isPaymentConfirmed_(movement.Pago);
  }).map(function(movement) {
    return {
      id: movement.ID,
      competence: movement.Competência,
      description: movement.Descrição,
      dueDate: movement['Data de Vencimento'],
      plannedValue: valueOrZero_(movement['Valor Planejado']),
      semaphore: calculateSemaphore_(movement, referenceDate)
    };
  }).sort(function(left, right) {
    return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
  });
}

function isPayableExpense_(movement) {
  return movement && (movement.Tipo === FIN.TYPES.EXPENSE || movement.Tipo === FIN.TYPES.CARD_BILL);
}

function getExpensePresentationRows_(period, referenceDate) {
  return period.filter(function(movement) {
    return isPayableExpense_(movement) && isAffirmative_(movement['Possui Vencimento']);
  }).map(function(movement) {
    return {
      id: movement.ID,
      description: movement.Descrição,
      dueDate: movement['Data de Vencimento'],
      plannedValue: valueOrZero_(movement['Valor Planejado']),
      realizedValue: asNumber_(movement['Valor Realizado']),
      paidValue: asNumber_(movement['Valor Pago']),
      paid: isPaymentConfirmed_(movement.Pago),
      semaphore: calculateSemaphore_(movement, referenceDate)
    };
  }).sort(function(left, right) {
    return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
  });
}

function getRevenuePresentationRows_(period) {
  return period.filter(function(movement) {
    return movement.Tipo === FIN.TYPES.REVENUE;
  }).map(function(movement) {
    return { id: movement.ID, description: movement.Descrição, value: valueOrZero_(movement['Valor Realizado']) };
  }).sort(function(left, right) {
    return String(left.description).localeCompare(String(right.description), 'pt-BR');
  });
}

function getCardBreakdownRows_(period) {
  var order = [];
  var byCategory = {};
  period.filter(function(movement) { return movement.Tipo === FIN.TYPES.CARD_PURCHASE; }).forEach(function(movement) {
    var category = movement.Categoria || 'Sem categoria';
    if (!byCategory[category]) {
      byCategory[category] = { category: category, plannedValue: 0, realizedValue: 0 };
      order.push(category);
    }
    byCategory[category].plannedValue += valueOrZero_(movement['Valor Planejado']);
    byCategory[category].realizedValue += valueOrZero_(movement['Valor Realizado']);
  });
  return order.map(function(category) { return byCategory[category]; });
}

function calculateFinancialSnapshot_(competence, movements, cardCurrent, currentAssets, referenceDate) {
  var period = movements.filter(function(movement) { return movement.Competência === competence; });
  var entries = 0;
  var plannedCost = 0;
  var nonCardActualExpenses = 0;
  var cardExpenses = 0;
  var cardByCategory = {};

  period.forEach(function(movement) {
    if (movement.Tipo === FIN.TYPES.REVENUE) {
      entries += valueOrZero_(movement['Valor Realizado']);
      return;
    }
    if (movement.Tipo === FIN.TYPES.EXPENSE || movement.Tipo === FIN.TYPES.CARD_BILL) {
      plannedCost += valueOrZero_(movement['Valor Planejado']);
    }
    if (movement.Tipo === FIN.TYPES.EXPENSE) {
      nonCardActualExpenses += valueOrZero_(movement['Valor Realizado']);
      return;
    }
    if (movement.Tipo === FIN.TYPES.CARD_PURCHASE) {
      var cardValue = valueOrZero_(movement['Valor Realizado']);
      cardExpenses += cardValue;
      var category = movement.Categoria || 'Sem categoria';
      cardByCategory[category] = (cardByCategory[category] || 0) + cardValue;
    }
  });

  var assetTotal = (currentAssets || []).reduce(function(sum, asset) {
    return sum + valueOrZero_(asset.Valor);
  }, 0);
  var launches = getLaunches_(movements, referenceDate || now_());
  var cardBreakdown = getCardBreakdownRows_(period);
  cardBreakdown.forEach(function(item) { cardByCategory[item.category] = item.realizedValue; });

  return {
    competence: competence,
    entries: entries,
    plannedCost: plannedCost,
    theoreticalResult: entries - plannedCost,
    nonCardActualExpenses: nonCardActualExpenses,
    cardExpenses: cardExpenses,
    actualExpenseTotal: nonCardActualExpenses + cardExpenses,
    currentResult: entries - (nonCardActualExpenses + cardExpenses),
    cardCurrent: valueOrZero_(cardCurrent),
    netWorth: assetTotal,
    launches: launches,
    cardByCategory: cardByCategory,
    revenues: getRevenuePresentationRows_(period),
    expenses: getExpensePresentationRows_(period, referenceDate || now_()),
    cardBreakdown: cardBreakdown,
    assets: currentAssets || []
  };
}

function getActiveCompetence_() {
  var configured = String(getConfigValue_(FIN.CONFIG_KEYS.CURRENT_YEAR, '')).trim() + '-' +
    String(getConfigValue_(FIN.CONFIG_KEYS.CURRENT_MONTH, '')).trim().padStart(2, '0');
  return isValidCompetence_(configured) ? configured : currentCompetence_();
}

function getFinancialSnapshot_(competence) {
  var chosenCompetence = competence || getActiveCompetence_();
  return calculateFinancialSnapshot_(
    chosenCompetence,
    getSheetRows_(FIN.SHEETS.MOVEMENTS),
    getCardCurrent_(chosenCompetence),
    getCurrentAssetPositions_(),
    now_()
  );
}
