/** Geração do relatório oficial em layout fixo para WhatsApp. */
function reportMoney_(value) {
  var number = asNumber_(value) || 0;
  var decimals = Math.abs(number % 1) > 0.000001;
  var rendered = decimals ? number.toFixed(2).replace('.', ',') : String(Math.round(number));
  return 'R$ ' + rendered.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function reportAmountOrEmpty_(value) {
  return value === null || value === undefined ? '' : reportMoney_(value);
}

function reportAbbreviatedAmount_(value) {
  var number = asNumber_(value) || 0;
  if (number !== 0 && Math.abs(number) % 1000 === 0) return String(number / 1000) + 'k';
  return reportMoney_(number);
}

function reportMonthName_(competence) {
  var months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return months[Number(String(competence).slice(5, 7)) - 1] || competence;
}

function resultSemaphoreEmoji_(value) {
  return value >= 0 ? '🟢' : '🔴';
}

function reportAssetLabel_(description) {
  var icons = {
    'COFRINHO MERCADOPAGO': '💵',
    'FUNDO IMOBILIÁRIO': '🏢',
    'EMERGÊNCIA': '🛟'
  };
  var icon = icons[normalizeKey_(description)] || '';
  return icon ? icon + ' ' + description : description;
}

function reportCardCategoryLabel_(category) {
  var icons = {
    'ALIMENTAÇÃO': '🍽️',
    'GASOLINA': '⛽',
    'MATHEUS': '👨',
    'MIRANDA': '👩',
    'ACADEMIA': '🏋️',
    'RESERVA INVESTIMENTO': '💰',
    'SAPHIRA NU': '🏦',
    'LIMPEZA CARRO': '🚗',
    'SPOTIFY': '🎵'
  };
  var icon = icons[normalizeKey_(category)] || '';
  return icon ? icon + ' ' + category : category;
}

function buildWhatsAppReport_(snapshot) {
  var reportDate = formatDate_(now_(), 'dd/MM');
  var launchTotal = dashboardLaunchTotal_(snapshot);
  var lines = [
    '📊 *Financeiro ' + reportMonthName_(snapshot.competence) + ' - ' + reportDate + '*',
    '',
    '💸 *Custo Planejado*: ' + reportMoney_(snapshot.plannedCost),
    '',
    '💼 *Entradas* (' + reportMoney_(snapshot.entries) + ')'
  ];
  if (snapshot.revenues.length) {
    snapshot.revenues.forEach(function(revenue) {
      lines.push(revenue.description + ': ' + reportMoney_(revenue.value));
    });
  } else {
    lines.push('Nenhuma entrada registrada.');
  }
  lines.push('');
  lines.push('🏦 *Patrimônio* (' + reportAbbreviatedAmount_(snapshot.netWorth) + ')');
  if (snapshot.assets.length) {
    snapshot.assets.forEach(function(asset) {
      lines.push(reportAssetLabel_(asset.Descrição) + ': ' + reportAbbreviatedAmount_(asset.Valor));
    });
  } else {
    lines.push('Nenhum patrimônio registrado.');
  }
  lines.push('');
  lines.push('💳 *Controle de Saldo*');
  lines.push('💳 *Cartão atual (' + reportDate + ')*: ' + reportMoney_(snapshot.cardCurrent));
  lines.push('📌 *Lançamentos Futuros (' + reportDate + ')*: ' + reportMoney_(launchTotal));
  lines.push('');
  lines.push('🧮 *Resultado teórico do mês*');
  lines.push(resultSemaphoreEmoji_(snapshot.theoreticalResult) + ' *Diferença: ' + (snapshot.theoreticalResult >= 0 ? '+ ' : '- ') + reportMoney_(Math.abs(snapshot.theoreticalResult)) + '*');
  lines.push('');
  lines.push('🧮 *Resultado atual do mês*');
  lines.push(resultSemaphoreEmoji_(snapshot.currentResult) + ' *Diferença: ' + (snapshot.currentResult >= 0 ? '+ ' : '- ') + reportMoney_(Math.abs(snapshot.currentResult)) + '*');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('🚦 *Semáforo dos Vencimentos*');
  if (snapshot.expenses.length) {
    snapshot.expenses.forEach(function(expense) {
      lines.push(semaphoreEmoji_(expense.semaphore) + ' ' + formatDate_(expense.dueDate, 'dd/MM') + ' ' + expense.description);
    });
  } else {
    lines.push('Nenhuma despesa com vencimento.');
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📋 *Despesas*');
  if (snapshot.expenses.length) {
    snapshot.expenses.forEach(function(expense) {
      lines.push(formatDate_(expense.dueDate, 'dd/MM') + ' ' + expense.description + ': ' +
        reportMoney_(expense.plannedValue) + ' (' + reportAmountOrEmpty_(expense.realizedValue) + ')');
    });
  } else {
    lines.push('Nenhuma despesa registrada.');
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💳 *Detalhamento do Cartão*');
  if (snapshot.cardBreakdown.length) {
    snapshot.cardBreakdown.forEach(function(item) {
      lines.push(reportCardCategoryLabel_(item.category) + ': ' + reportMoney_(item.plannedValue) + ' (' + reportMoney_(item.realizedValue) + ')');
    });
  } else {
    lines.push('Nenhuma compra no cartão registrada.');
  }
  return lines.join('\n');
}

function refreshWhatsAppReport_(tx, snapshot) {
  var rows = [
    ['RELATÓRIO WHATSAPP — FINANCEIRO 3.1'],
    ['Competência: ' + snapshot.competence],
    [''],
    [buildWhatsAppReport_(snapshot)]
  ];
  var sheet = getSheet_(FIN.SHEETS.REPORT);
  tx.replaceView(sheet, rows);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);
  sheet.getRange('A1').setBackground('#163A5F').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(13);
  sheet.getRange('A2').setBackground('#EAF1F8').setFontColor('#35546F').setFontWeight('bold');
  sheet.getRange('A4').setFontFamily('Arial').setFontSize(11).setWrap(true).setVerticalAlignment('top');
  sheet.setColumnWidth(1, 620);
  sheet.setRowHeight(1, 28);
  sheet.setRowHeight(2, 22);
  sheet.setRowHeight(4, Math.max(420, buildWhatsAppReport_(snapshot).split('\n').length * 19));
}
