import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "outputs");
const now = new Date();
const competence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const timestamp = now.toISOString().slice(0, 19);

const sheets = [
  ["01 - Configurações", ["ID", "Nome", "Valor", "Descrição", "Atualizado Em"]],
  ["02 - Receitas", ["ID Movimento", "Competência", "Data", "Descrição", "Categoria", "Valor Realizado", "Observação", "Origem"]],
  ["03 - Cadastro de Despesas", ["ID", "Descrição", "Categoria ID", "Categoria", "Valor Planejado", "Possui Vencimento", "Dia do Vencimento", "Recorrente", "Ativa", "Observação", "Criado Em", "Atualizado Em"]],
  ["04 - Movimentações", ["ID", "Competência", "Data", "Tipo", "Origem", "Cadastro Despesa ID", "Descrição", "Categoria ID", "Categoria", "Valor Planejado", "Valor Realizado", "Valor Pago", "Possui Vencimento", "Data de Vencimento", "Pago", "Data do Pagamento", "Observação", "Criado Em", "Atualizado Em"]],
  ["05 - Categorias", ["ID", "Categoria", "Ativa", "Observação", "Criado Em", "Atualizado Em"]],
  ["06 - Patrimônio", ["ID", "Ativo ID", "Descrição", "Valor", "Data", "Observação", "Origem", "Registrado Em"]],
  ["07 - Histórico", ["ID", "Data", "Hora", "Usuário", "Operação", "Tabela", "Registro", "Valor Anterior", "Valor Novo", "Resultado", "Erro"]],
  ["08 - Dashboard", ["FINANCEIRO 3.1 — DASHBOARD"]],
  ["09 - Relatório WhatsApp", ["RELATÓRIO WHATSAPP — FINANCEIRO 3.1"]],
];

const workbook = Workbook.create();
function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidthPx = width;
  });
}

for (const [name, headers] of sheets) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#163A5F",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#0F2740" },
  };
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.rowHeight = 28;
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.autofitColumns();
}

const config = workbook.worksheets.getItem("01 - Configurações");
config.getRange("A2:E5").values = [
  ["CFG-MES-ATUAL", "MÊS_ATUAL", competence.slice(5), "Mês exibido no Dashboard e no relatório.", timestamp],
  ["CFG-ANO-ATUAL", "ANO_ATUAL", competence.slice(0, 4), "Ano exibido no Dashboard e no relatório.", timestamp],
  ["CFG-MOEDA", "MOEDA", "BRL", "Moeda oficial.", timestamp],
  ["CFG-USUARIO", "NOME_USUÁRIO", "", "Nome do usuário para referência.", timestamp],
];
config.getRange("A1:E5").format.borders = { preset: "outside", style: "thin", color: "#D5DEE8" };
setColumnWidths(config, [150, 180, 100, 280, 170]);

const categories = workbook.worksheets.getItem("05 - Categorias");
const initialCategories = ["Alimentação", "Gasolina", "Matheus", "Miranda", "Spotify", "Academia", "Moradia", "Educação", "Saúde", "Lazer", "Outras"];
categories.getRangeByIndexes(1, 0, initialCategories.length, 6).values = initialCategories.map((name, index) => [
  `CAT-SEED-${String(index + 1).padStart(2, "0")}`,
  name,
  "Sim",
  "Categoria inicial do Financeiro 3.1.",
  timestamp,
  timestamp,
]);
categories.getRange("A1:F12").format.borders = { preset: "outside", style: "thin", color: "#D5DEE8" };
setColumnWidths(categories, [220, 180, 80, 280, 170, 170]);

const dashboard = workbook.worksheets.getItem("08 - Dashboard");
dashboard.getRange("A1:B14").values = [
  ["FINANCEIRO 3.1 — DASHBOARD", ""],
  ["Competência", competence],
  ["", ""],
  ["Indicador", "Valor"],
  ["Entradas", ""],
  ["Custo Planejado", ""],
  ["Resultado Teórico", ""],
  ["Resultado Atual", ""],
  ["Cartão Atual (manual)", ""],
  ["Cartão (Despesas)", ""],
  ["Patrimônio Atual", ""],
  ["", ""],
  ["LANÇAMENTOS PENDENTES", ""],
  ["Semáforo", "Vencimento"],
];
dashboard.getRange("A1:D1").format = { fill: "#163A5F", font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("A4:D4").format = { fill: "#DCE6F1", font: { bold: true } };
dashboard.getRange("A13:D13").format = { fill: "#DCE6F1", font: { bold: true } };
dashboard.getRange("A14:D14").format = { fill: "#EDF3F9", font: { bold: true } };
dashboard.getRange("B5:B11").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
dashboard.getRange("A1:D14").format.borders = { preset: "outside", style: "thin", color: "#D5DEE8" };
dashboard.getRange("A:A").format.columnWidthPx = 220;
dashboard.getRange("B:B").format.columnWidthPx = 150;

const report = workbook.worksheets.getItem("09 - Relatório WhatsApp");
report.getRange("A1:A4").values = [
  ["RELATÓRIO WHATSAPP — FINANCEIRO 3.1"],
  [`Competência: ${competence}`],
  [""],
  ["O Apps Script gerará automaticamente o relatório completo nesta célula."],
];
report.getRange("A1").format = { fill: "#163A5F", font: { bold: true, color: "#FFFFFF" } };
report.getRange("A4").format.wrapText = true;
report.getRange("A:A").format.columnWidthPx = 520;
report.getRange("A4").format.rowHeight = 60;

const movements = workbook.worksheets.getItem("04 - Movimentações");
movements.getRange("J:L").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
setColumnWidths(movements, [220, 105, 110, 130, 130, 220, 220, 200, 160, 130, 130, 120, 140, 145, 90, 145, 270, 165, 165]);

const catalog = workbook.worksheets.getItem("03 - Cadastro de Despesas");
catalog.getRange("E:E").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
setColumnWidths(catalog, [220, 220, 190, 160, 130, 140, 145, 105, 90, 270, 165, 165]);

const assets = workbook.worksheets.getItem("06 - Patrimônio");
assets.getRange("D:D").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
setColumnWidths(assets, [220, 220, 220, 130, 110, 270, 140, 165]);

const revenues = workbook.worksheets.getItem("02 - Receitas");
revenues.getRange("F:F").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
setColumnWidths(revenues, [220, 105, 110, 220, 160, 130, 270, 140]);

const history = workbook.worksheets.getItem("07 - Histórico");
setColumnWidths(history, [220, 100, 90, 220, 200, 180, 220, 270, 270, 100, 330]);

// Carga inicial autorizada: competência julho de 2026, posição de 29/07/2026.
const snapshot = "2026-07-29T12:00:00";
const augustSnapshot = "2026-08-03T12:00:00";
const id = (prefix, index) => `${prefix}-00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const categoryRows = [
  ["Alimentação", "Sim"], ["Gasolina", "Sim"], ["Matheus", "Sim"], ["Miranda", "Sim"], ["Spotify", "Sim"],
  ["Academia", "Sim"], ["Moradia", "Sim"], ["Educação", "Sim"], ["Saúde", "Sim"], ["Lazer", "Sim"], ["Outras", "Sim"],
  ["Reserva Investimento", "Sim"], ["Saphira Nu", "Sim"], ["Limpeza Carro", "Sim"],
];
categories.getRange("A2:F15").values = categoryRows.map(([name, active], index) => [
  id("CAT", index + 1), name, active, "Carga inicial autorizada em 29/07/2026.", snapshot, snapshot,
]);
const categoryId = Object.fromEntries(categoryRows.map(([name], index) => [name, id("CAT", index + 1)]));

config.getRange("A2:E10").values = [
  [id("CFG", 1), "MÊS_ATUAL", "08", "Competência exibida no Dashboard e no relatório.", augustSnapshot],
  [id("CFG", 2), "ANO_ATUAL", "2026", "Competência exibida no Dashboard e no relatório.", snapshot],
  [id("CFG", 3), "MOEDA", "BRL", "Moeda oficial.", snapshot],
  [id("CFG", 4), "NOME_USUÁRIO", "", "Nome do usuário para referência.", snapshot],
  [id("CFG", 5), "CARTAO_ATUAL::2026-07", 4203, "Cartão Atual manual informado para julho de 2026.", snapshot],
  [id("CFG", 6), "CARGA_INICIAL_JULHO_2026", "CONCLUÍDA", "Carga inicial autorizada em 29/07/2026; não executar novamente.", snapshot],
  [id("CFG", 7), "CARTAO_ATUAL::2026-08", 105, "Cartão Atual manual informado para agosto de 2026.", augustSnapshot],
  [id("CFG", 8), "CARGA_ATUALIZACAO_AGOSTO_2026", "CONCLUÍDA", "Atualização autorizada em 03/08/2026; não executar novamente.", augustSnapshot],
  [id("CFG", 9), "PAGAMENTO_FATURA_JULHO_2026_08_02", "CONCLUÍDA", "Fatura de julho de 2026 quitada em 02/08/2026 por confirmação explícita.", augustSnapshot],
];

const expenses = [
  ["📱 Telefone", "Outras", 80, 36, 5], ["🌐 Internet", "Outras", 120, 210, 5],
  ["🏠 Aluguel", "Moradia", 1000, 800, 15], ["💧 Água", "Moradia", 100, 1, 16],
  ["🏋️ Academia", "Academia", 185, 185, 21], ["🎓 Escola Saphira", "Educação", 920, 920, 29],
  ["🏐 Vôlei", "Lazer", 90, 90, 29], ["📺 IPTV", "Lazer", 30, 30, 29],
];
const catalogRows = expenses.map(([description, category, planned, _actual, dueDay], index) => [
  id("CAD", index + 1), description, categoryId[category], category, planned, "Sim", dueDay, "Sim", "Sim",
  "Cadastro incluído pela carga inicial de julho de 2026.", snapshot, snapshot,
]);
catalog.getRange("A2:L9").values = catalogRows;

const movementRows = [];
let movementIndex = 1;
const appendMovement = (values) => {
  movementRows.push(values);
  movementIndex += 1;
};
const movementId = () => id("MOV", movementIndex);
appendMovement([movementId(), "2026-07", snapshot, "RECEITA", "SISTEMA", "", "👨 Salário Matheus", categoryId.Matheus, "Matheus", "", 6000, "", "Não", "", "N/A", "", "Carga inicial autorizada em 29/07/2026.", snapshot, snapshot]);
appendMovement([movementId(), "2026-07", snapshot, "RECEITA", "SISTEMA", "", "👩 Salário Miranda", categoryId.Miranda, "Miranda", "", 1600, "", "Não", "", "N/A", "", "Carga inicial autorizada em 29/07/2026.", snapshot, snapshot]);
expenses.forEach(([description, category, planned, actual, dueDay], index) => {
  const due = `2026-07-${String(dueDay).padStart(2, "0")}T12:00:00`;
  appendMovement([movementId(), "2026-07", snapshot, "DESPESA", "RECORRÊNCIA", id("CAD", index + 1), description, categoryId[category], category, planned, actual, actual, "Sim", due, "Sim", due, "Pagamento explicitamente autorizado na carga inicial.", snapshot, snapshot]);
});
const cardDetails = [
  ["Alimentação", 1500, 2056], ["Gasolina", 700, 879], ["Matheus", 600, 1480], ["Miranda", 1000, 1000], ["Academia", 185, 185],
  ["Reserva Investimento", 100, 100], ["Saphira Nu", 100, 100], ["Limpeza Carro", 100, 30], ["Spotify", 32, 32],
];
cardDetails.forEach(([category, planned, actual]) => {
  appendMovement([movementId(), "2026-07", snapshot, "COMPRA_CARTAO", "SISTEMA", "", `💳 ${category}`, categoryId[category], category, planned, actual, "", "Não", "", "Não", "", "Detalhamento do cartão da carga inicial em 29/07/2026.", snapshot, snapshot]);
});
appendMovement([movementId(), "2026-07", snapshot, "FATURA_CARTAO", "SISTEMA", "", "💳 Cartão", categoryId.Outras, "Outras", 5237, 5237, 5237, "Sim", "2026-08-08T12:00:00", "Sim", "2026-08-02T12:00:00", "Pagamento total confirmado em 02/08/2026; o detalhamento do cartão permanece exclusivamente gerencial.", snapshot, augustSnapshot]);
const augustExpenses = [
  ["📱 Telefone", "Outras", 80, 35, 5, "Sim"], ["🌐 Internet", "Outras", 120, 120, 5, "Sim"],
  ["🏠 Aluguel", "Moradia", 1000, "", 15, "Não"], ["💧 Água", "Moradia", 100, "", 16, "Não"],
  ["🏋️ Academia", "Academia", 185, 185, 21, "Sim"], ["🎓 Escola Saphira", "Educação", 920, "", 29, "Não"],
  ["🏐 Vôlei", "Lazer", 90, "", 29, "Não"], ["📺 IPTV", "Lazer", 30, "", 29, "Não"],
];
appendMovement([movementId(), "2026-08", augustSnapshot, "RECEITA", "SISTEMA", "", "👨 Salário Matheus", categoryId.Matheus, "Matheus", "", 6000, "", "Não", "", "N/A", "", "Atualização autorizada em 03/08/2026.", augustSnapshot, augustSnapshot]);
appendMovement([movementId(), "2026-08", augustSnapshot, "RECEITA", "SISTEMA", "", "👩 Salário Miranda", categoryId.Miranda, "Miranda", "", 1600, "", "Não", "", "N/A", "", "Atualização autorizada em 03/08/2026.", augustSnapshot, augustSnapshot]);
augustExpenses.forEach(([description, category, planned, actual, dueDay, paid], index) => {
  const due = `2026-08-${String(dueDay).padStart(2, "0")}T12:00:00`;
  const note = paid === "Sim"
    ? "Pagamento explicitamente autorizado na atualização de 03/08/2026."
    : "Recorrência pendente; nenhum pagamento foi inferido.";
  appendMovement([movementId(), "2026-08", augustSnapshot, "DESPESA", "RECORRÊNCIA", id("CAD", index + 1), description, categoryId[category], category, planned, actual, paid === "Sim" ? actual : "", "Sim", due, paid, paid === "Sim" ? due : "", note, augustSnapshot, augustSnapshot]);
});
const augustCardDetails = [
  ["Alimentação", 1500, 1053], ["Gasolina", 700, 0], ["Matheus", 600, 185], ["Miranda", 1000, 1000], ["Academia", 185, 185],
  ["Reserva Investimento", 100, 0], ["Saphira Nu", 100, 0], ["Limpeza Carro", 100, 0], ["Spotify", 32, 32],
];
augustCardDetails.forEach(([category, planned, actual]) => {
  appendMovement([movementId(), "2026-08", augustSnapshot, "COMPRA_CARTAO", "SISTEMA", "", `💳 ${category}`, categoryId[category], category, planned, actual, "", "Não", "", "Não", "", "Detalhamento do cartão informado em 03/08/2026.", augustSnapshot, augustSnapshot]);
});
appendMovement([movementId(), "2026-08", augustSnapshot, "FATURA_CARTAO", "SISTEMA", "", "💳 Cartão", categoryId.Outras, "Outras", 5237, "", "", "Sim", "2026-09-08T12:00:00", "Não", "", "Cartão pendente; o realizado é derivado exclusivamente do detalhamento.", augustSnapshot, augustSnapshot]);
movements.getRangeByIndexes(1, 0, movementRows.length, 19).values = movementRows;

const revenueRows = movementRows.filter((row) => row[3] === "RECEITA").map((row) => [row[0], row[1], row[2], row[6], row[8], row[10], row[16], row[4]]);
revenues.getRangeByIndexes(1, 0, revenueRows.length, 8).values = revenueRows;

assets.getRange("A2:H7").values = [
  [id("PAT", 1), id("ATV", 1), "Cofrinho MercadoPago", 98000, snapshot, "Patrimônio informado na carga inicial.", "SISTEMA", snapshot],
  [id("PAT", 2), id("ATV", 2), "Fundo Imobiliário", 24000, snapshot, "Patrimônio informado na carga inicial.", "SISTEMA", snapshot],
  [id("PAT", 3), id("ATV", 3), "Emergência", 10000, snapshot, "Patrimônio informado na carga inicial.", "SISTEMA", snapshot],
  [id("PAT", 4), id("ATV", 1), "Cofrinho MercadoPago", 93000, augustSnapshot, "Patrimônio informado na atualização de agosto.", "SISTEMA", augustSnapshot],
  [id("PAT", 5), id("ATV", 2), "Fundo Imobiliário", 24000, augustSnapshot, "Patrimônio informado na atualização de agosto.", "SISTEMA", augustSnapshot],
  [id("PAT", 6), id("ATV", 3), "Emergência", 10000, augustSnapshot, "Patrimônio informado na atualização de agosto.", "SISTEMA", augustSnapshot],
];

const historyRows = [];
let historyIndex = 1;
const appendHistory = (operation, table, record, previous, next, eventDate = "2026-07-29", user = "Carga inicial") => {
  historyRows.push([id("HIS", historyIndex++), eventDate, "12:00:00", user, operation, table, record, previous || "", next || "", "SUCESSO", ""]);
};
categoryRows.slice(11).forEach((row, index) => appendHistory("Carga inicial — cadastrar categoria", "05 - Categorias", id("CAT", index + 12), "", row[0]));
catalogRows.forEach((row) => appendHistory("Carga inicial — cadastrar despesa", "03 - Cadastro de Despesas", row[0], "", `Valor planejado: ${row[4]}`));
movementRows.forEach((row) => {
  const isAugust = row[1] === "2026-08";
  appendHistory(
    isAugust ? "Atualização de agosto — registrar movimentação" : "Carga inicial — registrar movimentação",
    "04 - Movimentações", row[0], "", `${row[3]}: ${row[6]}`,
    isAugust ? "2026-08-03" : "2026-07-29", isAugust ? "Atualização de agosto" : "Carga inicial",
  );
});
movementRows.filter((row) => ["DESPESA", "FATURA_CARTAO"].includes(row[3]) && row[14] === "Sim").forEach((row) => {
  const isAugust = row[1] === "2026-08";
  const isJulyCardSettlement = row[3] === "FATURA_CARTAO" && row[1] === "2026-07";
  appendHistory(
    isJulyCardSettlement ? "Registrar pagamento — fatura de julho" : (isAugust ? "Atualização de agosto — registrar pagamento" : "Carga inicial — registrar pagamento"),
    "04 - Movimentações", row[0], "Pago: Não", `Pago: Sim; Valor pago: ${row[11]}`,
    isJulyCardSettlement ? "2026-08-02" : (isAugust ? "2026-08-03" : "2026-07-29"),
    isJulyCardSettlement ? "Confirmação do usuário" : (isAugust ? "Atualização de agosto" : "Carga inicial"),
  );
});
assets.getRange("A2:A7").values.flat().forEach((assetId, index) => {
  const isAugust = index >= 3;
  appendHistory(
    isAugust ? "Atualização de agosto — atualizar patrimônio" : "Carga inicial — atualizar patrimônio",
    "06 - Patrimônio", assetId, "", isAugust ? "Posição atualizada" : "Posição inicial",
    isAugust ? "2026-08-03" : "2026-07-29", isAugust ? "Atualização de agosto" : "Carga inicial",
  );
});
appendHistory("Carga inicial — atualizar Cartão Atual", "01 - Configurações", "CARTAO_ATUAL::2026-07", "", "4203");
appendHistory("Carga inicial — concluir julho de 2026", "01 - Configurações", "CARGA_INICIAL_JULHO_2026", "", "Custo Planejado 7762; Resultado Teórico -162; Resultado Atual -534");
appendHistory("Atualização de agosto — definir competência atual", "01 - Configurações", "MÊS_ATUAL", "07", "08", "2026-08-03", "Atualização de agosto");
appendHistory("Atualização de agosto — atualizar Cartão Atual", "01 - Configurações", "CARTAO_ATUAL::2026-08", "", "105", "2026-08-03", "Atualização de agosto");
appendHistory("Registrar pagamento — fatura de julho", "01 - Configurações", "PAGAMENTO_FATURA_JULHO_2026_08_02", "", "Data: 02/08/2026; Valor: 5237", "2026-08-02", "Confirmação do usuário");
appendHistory("Atualização — concluir agosto de 2026", "01 - Configurações", "CARGA_ATUALIZACAO_AGOSTO_2026", "", "Custo Planejado 7762; Resultado Teórico -162; Resultado Atual 4805", "2026-08-03", "Atualização de agosto");
history.getRangeByIndexes(1, 0, historyRows.length, 11).values = historyRows;

const dashboardRows = [
  ["FINANCEIRO 3.1 — PAINEL EXECUTIVO", "", "", "", ""], ["Competência", "2026-08", "", "Atualizado em", "03/08/2026 12:00"], ["", "", "", "", ""],
  ["ENTRADAS", 7600, "", "CUSTO PLANEJADO", 7762],
  ["RESULTADO TEÓRICO", -162, "", "RESULTADO ATUAL", 4805],
  ["CARTÃO ATUAL", 105, "", "CARTÃO (DESPESAS)", 2455],
  ["PATRIMÔNIO", 127000, "", "LANÇAMENTOS PENDENTES", 7377],
  ["", "", "", "", ""], ["LANÇAMENTOS PENDENTES", "", "", "", ""], ["Semáforo", "Vencimento", "Descrição", "Valor planejado", "Competência"],
  ["🟡 AMARELO", "15/08/2026", "🏠 Aluguel", 1000, "2026-08"], ["🟡 AMARELO", "16/08/2026", "💧 Água", 100, "2026-08"],
  ["🟡 AMARELO", "29/08/2026", "🎓 Escola Saphira", 920, "2026-08"], ["🟡 AMARELO", "29/08/2026", "🏐 Vôlei", 90, "2026-08"],
  ["🟡 AMARELO", "29/08/2026", "📺 IPTV", 30, "2026-08"], ["🟡 AMARELO", "08/09/2026", "💳 Cartão", 5237, "2026-08"],
  ["", "", "", "", ""], ["DETALHAMENTO DO CARTÃO", "", "", "", ""], ["Categoria", "Planejado", "Realizado", "", ""],
  ...augustCardDetails.map(([category, planned, actual]) => [category, planned, actual, "", ""]),
];
dashboard.getRangeByIndexes(0, 0, dashboardRows.length, 5).values = dashboardRows;
dashboard.getRange(`A1:E${dashboardRows.length}`).format = { font: { name: "Arial" }, verticalAlignment: "center" };
dashboard.getRange("A1:E1").format = { fill: "#163A5F", font: { bold: true, color: "#FFFFFF", size: 15 } };
dashboard.getRange("A2:E2").format = { fill: "#EAF1F8", font: { bold: true, color: "#35546F" } };
[["A4", "B4", "#2F75B5"], ["D4", "E4", "#5B9BD5"], ["A5", "B5", "#7F8C8D"], ["D5", "E5", "#008C72"], ["A6", "B6", "#8064A2"], ["D6", "E6", "#4F81BD"], ["A7", "B7", "#C55A11"], ["D7", "E7", "#BF9000"]].forEach(([label, value, color]) => {
  dashboard.getRange(label).format = { fill: color, font: { bold: true, color: "#FFFFFF" } };
  dashboard.getRange(value).format = { fill: "#F7FAFC", font: { bold: true, size: 14 }, horizontalAlignment: "right" };
});
dashboard.getRange("A9:E9").format = { fill: "#D9EAF7", font: { bold: true, color: "#163A5F" } };
dashboard.getRange("A10:E10").format = { fill: "#EDF3F9", font: { bold: true } };
dashboard.getRange("A18:E18").format = { fill: "#D9EAF7", font: { bold: true, color: "#163A5F" } };
dashboard.getRange("A19:E19").format = { fill: "#EDF3F9", font: { bold: true } };
dashboard.getRange("A11:E16").format = { fill: "#FFF2CC" };
dashboard.getRange("B4:B7").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
dashboard.getRange("E4:E7").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
dashboard.getRange("D11:D16").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
dashboard.getRange(`B20:C${19 + augustCardDetails.length}`).format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
setColumnWidths(dashboard, [215, 135, 185, 210, 120]);
dashboard.getRange("A1:E1").format.rowHeight = 30;
dashboard.getRange("A2:E2").format.rowHeight = 22;
dashboard.getRange("G1:H4").values = [["Indicador", "Valor"], ["Planejado", null], ["Realizado", null], ["Pendente", null]];
dashboard.getRange("H2:H4").formulas = [["=$E$4"], ["=$B$4-$E$5"], ["=$E$7"]];
dashboard.getRange("G1:H4").format = { font: { color: "#FFFFFF", size: 8 }, fill: "#FFFFFF" };
dashboard.getRange("H2:H4").format.numberFormat = "R$ #,##0.00;[Red]-R$ #,##0.00";
dashboard.getRange("G:G").format.columnWidthPx = 8;
dashboard.getRange("H:H").format.columnWidthPx = 8;
const executionChart = dashboard.charts.add("bar", dashboard.getRange("G1:H4"));
executionChart.title = "Execução financeira";
executionChart.hasLegend = false;
executionChart.setPosition("G3", "N17");

const reportLines = [
  "📊 *Financeiro Agosto - 03/08*", "", "💸 *Custo Planejado*: R$ 7.762", "",
  "💼 *Entradas* (R$ 7.600)", "👨 Salário Matheus: R$ 6.000", "👩 Salário Miranda: R$ 1.600", "",
  "🏦 *Patrimônio* (127k)", "💵 Cofrinho MercadoPago: 93k", "🏢 Fundo Imobiliário: 24k", "🛟 Emergência: 10k", "",
  "💳 *Controle de Saldo*", "💳 *Cartão atual (03/08)*: R$ 105", "📌 *Lançamentos (03/08)*: R$ 7.377", "",
  "🧮 *Resultado teórico do mês*", "🔴 *Diferença: - R$ 162*", "", "🧮 *Resultado atual do mês*", "🟢 *Diferença: + R$ 4.805*", "",
  "━━━━━━━━━━━━━━━", "", "🚦 *Semáforo dos Vencimentos*", "🟢 05/08 📱 Telefone", "🟢 05/08 🌐 Internet", "🟡 15/08 🏠 Aluguel", "🟡 16/08 💧 Água", "🟢 21/08 🏋️ Academia", "🟡 29/08 🎓 Escola Saphira", "🟡 29/08 🏐 Vôlei", "🟡 29/08 📺 IPTV", "🟡 08/09 💳 Cartão", "",
  "━━━━━━━━━━━━━━━", "", "📋 *Despesas*", "05/08 📱 Telefone: R$ 80 (R$ 35)", "05/08 🌐 Internet: R$ 120 (R$ 120)", "15/08 🏠 Aluguel: R$ 1.000 ()", "16/08 💧 Água: R$ 100 ()", "21/08 🏋️ Academia: R$ 185 (R$ 185)", "29/08 🎓 Escola Saphira: R$ 920 ()", "29/08 🏐 Vôlei: R$ 90 ()", "29/08 📺 IPTV: R$ 30 ()", "08/09 💳 Cartão: R$ 5.237 ()", "",
  "━━━━━━━━━━━━━━━", "", "💳 *Detalhamento do Cartão*", "🍽️ Alimentação: R$ 1.500 (R$ 1.053)", "⛽ Gasolina: R$ 700 (R$ 0)", "👨 Matheus: R$ 600 (R$ 185)", "👩 Miranda: R$ 1.000 (R$ 1.000)", "🏋️ Academia: R$ 185 (R$ 185)", "💰 Reserva Investimento: R$ 100 (R$ 0)", "🏦 Saphira Nu: R$ 100 (R$ 0)", "🚗 Limpeza Carro: R$ 100 (R$ 0)", "🎵 Spotify: R$ 32 (R$ 32)",
].join("\n");
report.getRange("A1:A4").values = [["RELATÓRIO WHATSAPP — FINANCEIRO 3.1"], ["Competência: 2026-08"], [""], [reportLines]];
report.getRange("A4").format.wrapText = true;
report.getRange("A2").format = { fill: "#EAF1F8", font: { bold: true, color: "#35546F" } };
report.getRange("A4").format = { font: { name: "Arial", size: 11 }, wrapText: true, verticalAlignment: "top" };
report.getRange("A4").format.rowHeightPx = 1300;

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "Financeiro_3.1.xlsx"));

console.log(`Template gerado: ${sheets.length} abas.`);
