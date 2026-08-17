/** Visualizações derivadas. Nenhuma função desta unidade altera dados financeiros. */
function semaphoreEmoji_(semaphore) {
  if (semaphore === FIN.SEMAPHORE.GREEN) return '🟢';
  if (semaphore === FIN.SEMAPHORE.YELLOW) return '🟡';
  if (semaphore === FIN.SEMAPHORE.RED) return '🔴';
  return '⚪';
}

function refreshRevenueView_(tx) {
  var rows = [FIN.HEADERS.REVENUES];
  getSheetRows_(FIN.SHEETS.MOVEMENTS).filter(function(movement) {
    return movement.Tipo === FIN.TYPES.REVENUE;
  }).sort(function(left, right) {
    return new Date(left.Data).getTime() - new Date(right.Data).getTime();
  }).forEach(function(movement) {
    rows.push([
      movement.ID, movement.Competência, movement.Data, movement.Descrição,
      movement.Categoria, movement['Valor Realizado'], movement.Observação, movement.Origem
    ]);
  });
  tx.replaceView(getSheet_(FIN.SHEETS.REVENUES), rows);
}

function dashboardLaunchTotal_(snapshot) {
  return snapshot.launches.reduce(function(total, launch) { return total + launch.plannedValue; }, 0);
}

function dashboardColorForSemaphore_(semaphore) {
  if (semaphore === FIN.SEMAPHORE.GREEN) return '#E2F0D9';
  if (semaphore === FIN.SEMAPHORE.YELLOW) return '#FFF2CC';
  if (semaphore === FIN.SEMAPHORE.RED) return '#FCE4D6';
  return '#F3F6F8';
}

function styleDashboardCard_(sheet, labelRange, valueRange, color) {
  sheet.getRange(labelRange).setBackground(color).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(valueRange).setBackground('#F7FAFC').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right');
}

function rebuildDashboardChart_(sheet, snapshot) {
  sheet.getCharts().forEach(function(chart) { sheet.removeChart(chart); });
  sheet.getRange('N1:O4').setValues([
    ['Indicador', 'Valor'],
    ['Planejado', snapshot.plannedCost],
    ['Realizado', snapshot.actualExpenseTotal],
    ['Futuro', dashboardLaunchTotal_(snapshot)]
  ]);
  sheet.getRange('N1:O4').setNumberFormat('R$ #,##0.00;[Red]-R$ #,##0.00');
  sheet.hideColumns(14, 2);
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange('N1:O4'))
    .setPosition(3, 6, 0, 0)
    .setOption('title', 'Execução financeira')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#2F75B5'])
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('chartArea', { left: 55, top: 45, width: '72%', height: '70%' })
    .build();
  sheet.insertChart(chart);
}

function refreshDashboard_(tx, snapshot) {
  var launchTotal = dashboardLaunchTotal_(snapshot);
  var rows = [
    ['FINANCEIRO 3.1 — PAINEL EXECUTIVO', '', '', '', ''],
    ['Competência', snapshot.competence, '', 'Atualizado em', formatDate_(now_(), 'dd/MM/yyyy HH:mm')],
    ['', '', '', '', ''],
    ['ENTRADAS', snapshot.entries, '', 'CUSTO PLANEJADO', snapshot.plannedCost],
    ['RESULTADO TEÓRICO', snapshot.theoreticalResult, '', 'RESULTADO ATUAL', snapshot.currentResult],
    ['CARTÃO ATUAL', snapshot.cardCurrent, '', 'CARTÃO (DESPESAS)', snapshot.cardExpenses],
    ['PATRIMÔNIO', snapshot.netWorth, '', 'LANÇAMENTOS FUTUROS', launchTotal],
    ['', '', '', '', ''],
    ['LANÇAMENTOS FUTUROS', '', '', '', ''],
    ['Semáforo', 'Vencimento', 'Descrição', 'Valor planejado', 'Competência']
  ];
  if (snapshot.launches.length) {
    snapshot.launches.forEach(function(launch) {
      rows.push([
        semaphoreEmoji_(launch.semaphore) + ' ' + launch.semaphore,
        formatDate_(launch.dueDate, 'dd/MM/yyyy'), launch.description, launch.plannedValue,
        launch.competence
      ]);
    });
  } else {
    rows.push(['—', '', 'Nenhum lançamento futuro.', '', '']);
  }
  rows.push(['', '', '', '', '']);
  rows.push(['DETALHAMENTO DO CARTÃO', '', '', '', '']);
  rows.push(['Categoria', 'Planejado', 'Realizado', '', '']);
  if (snapshot.cardBreakdown.length) {
    snapshot.cardBreakdown.forEach(function(item) {
      rows.push([item.category, item.plannedValue, item.realizedValue, '', '']);
    });
  } else {
    rows.push(['Sem compras no cartão.', '', '', '', '']);
  }
  var sheet = getSheet_(FIN.SHEETS.DASHBOARD);
  tx.replaceView(sheet, rows);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);
  sheet.getRange(1, 1, rows.length, 5).setFontFamily('Arial').setVerticalAlignment('middle');
  sheet.getRange('A1:E1').setBackground('#163A5F').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(15).setHorizontalAlignment('left');
  sheet.getRange('A2:E2').setBackground('#EAF1F8').setFontColor('#35546F').setFontWeight('bold');
  styleDashboardCard_(sheet, 'A4:A4', 'B4:B4', '#2F75B5');
  styleDashboardCard_(sheet, 'D4:D4', 'E4:E4', '#5B9BD5');
  styleDashboardCard_(sheet, 'A5:A5', 'B5:B5', '#7F8C8D');
  styleDashboardCard_(sheet, 'D5:D5', 'E5:E5', '#008C72');
  styleDashboardCard_(sheet, 'A6:A6', 'B6:B6', '#8064A2');
  styleDashboardCard_(sheet, 'D6:D6', 'E6:E6', '#4F81BD');
  styleDashboardCard_(sheet, 'A7:A7', 'B7:B7', '#C55A11');
  styleDashboardCard_(sheet, 'D7:D7', 'E7:E7', '#BF9000');
  sheet.getRange('B4:B7').setNumberFormat('R$ #,##0.00;[Red]-R$ #,##0.00');
  sheet.getRange('E4:E7').setNumberFormat('R$ #,##0.00;[Red]-R$ #,##0.00');
  sheet.getRange('B5').setFontColor(snapshot.theoreticalResult < 0 ? '#C00000' : '#008C72');
  sheet.getRange('E5').setFontColor(snapshot.currentResult < 0 ? '#C00000' : '#008C72');
  sheet.getRange('A9:E9').setBackground('#D9EAF7').setFontWeight('bold').setFontColor('#163A5F');
  sheet.getRange('A10:E10').setBackground('#EDF3F9').setFontWeight('bold');
  var launchStart = 11;
  snapshot.launches.forEach(function(launch, index) {
    sheet.getRange(launchStart + index, 1, 1, 5).setBackground(dashboardColorForSemaphore_(launch.semaphore));
  });
  var detailHeader = launchStart + Math.max(snapshot.launches.length, 1) + 1;
  sheet.getRange(detailHeader, 1, 1, 5).setBackground('#D9EAF7').setFontWeight('bold').setFontColor('#163A5F');
  sheet.getRange(detailHeader + 1, 1, 1, 5).setBackground('#EDF3F9').setFontWeight('bold');
  sheet.getRange(launchStart, 4, Math.max(snapshot.launches.length, 1), 1).setNumberFormat('R$ #,##0.00;[Red]-R$ #,##0.00');
  sheet.getRange(detailHeader + 2, 2, Math.max(snapshot.cardBreakdown.length, 1), 2).setNumberFormat('R$ #,##0.00;[Red]-R$ #,##0.00');
  sheet.getRange(1, 1, rows.length, 5).setBorder(false, false, false, false, false, false);
  sheet.getRange('A1:E1').setBorder(true, true, true, true, false, false, '#163A5F', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setColumnWidth(1, 215);
  sheet.setColumnWidth(2, 135);
  sheet.setColumnWidth(3, 185);
  sheet.setColumnWidth(4, 210);
  sheet.setColumnWidth(5, 120);
  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 24);
  rebuildDashboardChart_(sheet, snapshot);
}

function refreshAllVisualizations_(tx) {
  var snapshot = getFinancialSnapshot_(getActiveCompetence_());
  refreshRevenueView_(tx);
  refreshDashboard_(tx, snapshot);
  refreshWhatsAppReport_(tx, snapshot);
  return snapshot;
}
