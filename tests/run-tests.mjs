import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let uuid = 0;
const context = vm.createContext({
  console,
  Utilities: {
    getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    formatDate: (value, _timezone, pattern) => {
      const date = new Date(value);
      const parts = {
        yyyy: String(date.getUTCFullYear()),
        MM: String(date.getUTCMonth() + 1).padStart(2, "0"),
        dd: String(date.getUTCDate()).padStart(2, "0"),
        HH: String(date.getUTCHours()).padStart(2, "0"),
        mm: String(date.getUTCMinutes()).padStart(2, "0"),
        ss: String(date.getUTCSeconds()).padStart(2, "0"),
      };
      return pattern.replace("yyyy", parts.yyyy).replace("MM", parts.MM).replace("dd", parts.dd)
        .replace("HH", parts.HH).replace("mm", parts.mm).replace("ss", parts.ss);
    },
  },
  Session: { getActiveUser: () => ({ getEmail: () => "test@example.com" }) },
});

for (const file of ["src/config.gs", "src/utils.gs", "src/finance.gs", "src/cards.gs"]) {
  const source = await fs.readFile(path.join(root, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

let passed = 0;
function test(name, callback) {
  callback();
  passed += 1;
  console.log(`PASS ${name}`);
}

const FIN = context.FIN;
const date = (value) => new Date(`${value}T12:00:00Z`);
const movement = (values) => ({
  ID: values.ID || "MOV-TEST",
  Competência: "2026-07",
  Tipo: FIN.TYPES.EXPENSE,
  "Valor Planejado": "",
  "Valor Realizado": "",
  "Possui Vencimento": FIN.NO,
  "Data de Vencimento": "",
  Pago: FIN.NO,
  ...values,
});

test("CT-001: receita alimenta entradas e os dois resultados", () => {
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [
    movement({ ID: "MOV-REC", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 5000 }),
  ], 0, [], date("2026-07-10"));
  assert.equal(snapshot.entries, 5000);
  assert.equal(snapshot.theoreticalResult, 5000);
  assert.equal(snapshot.currentResult, 5000);
});

test("CT-002: cartão é agregado uma única vez e não altera Cartão Atual", () => {
  const data = [
    movement({ ID: "MOV-EXP", "Valor Planejado": 1000, "Valor Realizado": 800 }),
    movement({ ID: "MOV-CARD-A", Tipo: FIN.TYPES.CARD_PURCHASE, Categoria: "Alimentação", "Valor Realizado": 120 }),
    movement({ ID: "MOV-CARD-B", Tipo: FIN.TYPES.CARD_PURCHASE, Categoria: "Gasolina", "Valor Realizado": 80 }),
  ];
  const snapshot = context.calculateFinancialSnapshot_("2026-07", data, 900, [], date("2026-07-10"));
  assert.equal(snapshot.cardExpenses, 200);
  assert.equal(snapshot.cardCurrent, 900);
  assert.equal(snapshot.currentResult, -1000);
  assert.equal(snapshot.cardByCategory.Alimentação, 120);
  assert.equal(snapshot.cardByCategory.Gasolina, 80);
});

test("Custo Planejado inclui o planejado das compras no cartão", () => {
  const data = [
    movement({ ID: "MOV-EXP", "Valor Planejado": 1000, "Valor Realizado": 800 }),
    movement({ ID: "MOV-CARD-A", Tipo: FIN.TYPES.CARD_PURCHASE, Categoria: "Alimentação", "Valor Planejado": 1500, "Valor Realizado": 1500 }),
    movement({ ID: "MOV-CARD-B", Tipo: FIN.TYPES.CARD_PURCHASE, Categoria: "Gasolina", "Valor Planejado": 600, "Valor Realizado": 600 }),
  ];
  const snapshot = context.calculateFinancialSnapshot_("2026-07", data, 0, [], date("2026-07-10"));
  assert.equal(snapshot.plannedCost, 3100, "1000 (despesa) + 1500 + 600 (compras no cartão)");
});

test("CT-003: valor manual do Cartão Atual é independente dos movimentos", () => {
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [
    movement({ Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Realizado": 300 }),
  ], 1500, [], date("2026-07-10"));
  assert.equal(snapshot.cardCurrent, 1500);
  assert.equal(snapshot.cardExpenses, 300);
});

test("CT-004: semáforo e lançamentos dependem de pagamento explícito", () => {
  const unpaid = movement({
    "Possui Vencimento": FIN.YES,
    "Data de Vencimento": date("2026-07-09"),
    "Valor Planejado": 100,
    Descrição: "Internet",
  });
  const paid = movement({
    ID: "MOV-PAID",
    "Possui Vencimento": FIN.YES,
    "Data de Vencimento": date("2026-07-01"),
    Pago: FIN.YES,
    "Valor Planejado": 200,
  });
  assert.equal(context.calculateSemaphore_(unpaid, date("2026-07-10")), FIN.SEMAPHORE.RED);
  assert.equal(context.calculateSemaphore_(paid, date("2026-07-10")), FIN.SEMAPHORE.GREEN);
  const launches = context.getLaunches_([unpaid, paid], date("2026-07-10"));
  assert.equal(launches.length, 1);
  assert.equal(launches[0].id, unpaid.ID);
});

test("CT-005: patrimônio é indicador separado dos resultados", () => {
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [
    movement({ Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 1000 }),
  ], 0, [{ Valor: 500 }, { Valor: 1200 }], date("2026-07-10"));
  assert.equal(snapshot.netWorth, 1700);
  assert.equal(snapshot.currentResult, 1000);
});

test("RN-008: semáforo amarelo antes do vencimento e sem efeito em valores", () => {
  const future = movement({
    "Possui Vencimento": FIN.YES,
    "Data de Vencimento": date("2026-07-20"),
    "Valor Planejado": 250,
  });
  const before = JSON.stringify(future);
  assert.equal(context.calculateSemaphore_(future, date("2026-07-10")), FIN.SEMAPHORE.YELLOW);
  assert.equal(JSON.stringify(future), before);
});

test("RN-013: alterações de valores não inferem pagamento", () => {
  const expense = movement({ "Valor Planejado": 100, "Valor Realizado": 0, Pago: FIN.NO });
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [expense], 0, [], date("2026-07-10"));
  assert.equal(expense.Pago, FIN.NO);
  assert.equal(snapshot.currentResult, 0);
});

test("Recorrência: vencimento 31 é limitado ao último dia do mês", () => {
  assert.equal(context.formatDate_(context.dueDateForDay_("2026-02", 31), "yyyy-MM-dd"), "2026-02-28");
});

test("Virar o mês: próxima competência avança mês e ano corretamente", () => {
  assert.equal(context.nextCompetence_("2026-08"), "2026-09");
  assert.equal(context.nextCompetence_("2026-12"), "2027-01");
});

test("Validação de competência aceita somente AAAA-MM válido", () => {
  assert.equal(context.isValidCompetence_("2026-07"), true);
  assert.equal(context.isValidCompetence_("2026-13"), false);
  assert.equal(context.isValidCompetence_("07/2026"), false);
});

test("Valores aceitam vírgula ou ponto decimal sem alterar a quantia", () => {
  assert.equal(context.asNumber_("1.234,56"), 1234.56);
  assert.equal(context.asNumber_("1234.56"), 1234.56);
  assert.equal(context.asNumber_("1234,56"), 1234.56);
});

test("Carga inicial de julho: totais, cartão pendente e semáforo autorizado", () => {
  const paidExpenses = [
    [80, 36, "2026-07-05"], [120, 210, "2026-07-05"], [1000, 800, "2026-07-15"],
    [100, 1, "2026-07-16"], [185, 185, "2026-07-21"], [920, 920, "2026-07-29"],
    [90, 90, "2026-07-29"], [30, 30, "2026-07-29"],
  ].map(([planned, actual, dueDate], index) => movement({
    ID: `MOV-PAID-${index}`, "Valor Planejado": planned, "Valor Realizado": actual,
    "Possui Vencimento": FIN.YES, "Data de Vencimento": date(dueDate), Pago: FIN.YES,
  }));
  const cardPlanned = [1500, 700, 600, 1000, 185, 100, 100, 100, 32];
  const cardDetails = [2056, 879, 1480, 1000, 185, 100, 100, 30, 32]
    .map((actual, index) => movement({
      ID: `MOV-CARD-${index}`, Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Planejado": cardPlanned[index], "Valor Realizado": actual
    }));
  const pendingCard = movement({
    ID: "MOV-CARD-BILL", Tipo: FIN.TYPES.CARD_BILL, Descrição: "💳 Cartão", "Valor Planejado": 5237, "Valor Realizado": "",
    "Possui Vencimento": FIN.YES, "Data de Vencimento": date("2026-08-08"), Pago: FIN.NO,
  });
  const revenues = [
    movement({ ID: "MOV-SALARY-1", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 6000 }),
    movement({ ID: "MOV-SALARY-2", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 1600 }),
  ];
  const snapshot = context.calculateFinancialSnapshot_(
    "2026-07", [...paidExpenses, ...cardDetails, pendingCard, ...revenues], 4203,
    [{ Valor: 98000 }, { Valor: 24000 }, { Valor: 10000 }], date("2026-07-29")
  );
  // Custo Planejado = despesas (2525) + soma do detalhamento do cartão (4317).
  // O Valor Planejado gravado na própria fatura (5237) nunca é somado — ele
  // é só um número histórico independente e seria dupla contagem.
  assert.equal(snapshot.plannedCost, 6842);
  assert.equal(snapshot.theoreticalResult, 758);
  assert.equal(snapshot.currentResult, -534);
  assert.equal(snapshot.cardCurrent, 4203);
  assert.equal(snapshot.cardExpenses, 5862);
  assert.equal(snapshot.netWorth, 132000);
  assert.equal(snapshot.launches.length, 0, "fatura do cartão não deve entrar em Lançamentos Futuros");
});

test("Atualização de agosto: pagamentos explícitos, cartão independente e lançamentos futuros", () => {
  const augustMovement = (values) => movement({ Competência: "2026-08", ...values });
  const expenses = [
    ["Telefone", 80, 35, "2026-08-05", FIN.YES], ["Internet", 120, 120, "2026-08-05", FIN.YES],
    ["Aluguel", 1000, "", "2026-08-15", FIN.NO], ["Água", 100, "", "2026-08-16", FIN.NO],
    ["Academia", 185, 185, "2026-08-21", FIN.YES], ["Escola Saphira", 920, "", "2026-08-29", FIN.NO],
    ["Vôlei", 90, "", "2026-08-29", FIN.NO], ["IPTV", 30, "", "2026-08-29", FIN.NO],
  ].map(([description, planned, actual, dueDate, paid], index) => augustMovement({
    ID: `MOV-AUG-EXP-${index}`, Descrição: description, "Valor Planejado": planned, "Valor Realizado": actual,
    "Possui Vencimento": FIN.YES, "Data de Vencimento": date(dueDate), Pago: paid,
  }));
  const cardPlanned = [1500, 700, 600, 1000, 185, 100, 100, 100, 32];
  const cardDetails = [1053, 0, 185, 1000, 185, 0, 0, 0, 32]
    .map((actual, index) => augustMovement({
      ID: `MOV-AUG-CARD-${index}`, Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Planejado": cardPlanned[index], "Valor Realizado": actual
    }));
  const pendingCard = augustMovement({
    ID: "MOV-AUG-CARD-BILL", Tipo: FIN.TYPES.CARD_BILL, Descrição: "Cartão", "Valor Planejado": 5237, "Valor Realizado": "",
    "Possui Vencimento": FIN.YES, "Data de Vencimento": date("2026-09-08"), Pago: FIN.NO,
  });
  const revenues = [
    augustMovement({ ID: "MOV-AUG-SALARY-1", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 6000 }),
    augustMovement({ ID: "MOV-AUG-SALARY-2", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 1600 }),
  ];
  const snapshot = context.calculateFinancialSnapshot_(
    "2026-08", [...expenses, ...cardDetails, pendingCard, ...revenues], 105,
    [{ Valor: 93000 }, { Valor: 24000 }, { Valor: 10000 }], date("2026-08-03"),
  );
  assert.equal(snapshot.entries, 7600);
  assert.equal(snapshot.plannedCost, 6842);
  assert.equal(snapshot.theoreticalResult, 758);
  assert.equal(snapshot.currentResult, 4805);
  assert.equal(snapshot.cardCurrent, 105);
  assert.equal(snapshot.cardExpenses, 2455);
  assert.equal(snapshot.netWorth, 127000);
  assert.equal(snapshot.launches.length, 5, "fatura do cartão não deve entrar em Lançamentos Futuros");
  assert.equal(snapshot.launches.reduce((sum, launch) => sum + launch.plannedValue, 0), 2140);
  assert.ok(snapshot.launches.every((launch) => launch.semaphore === FIN.SEMAPHORE.YELLOW));
  assert.equal(context.calculateSemaphore_(expenses[0], date("2026-08-03")), FIN.SEMAPHORE.GREEN);
  assert.equal(context.calculateSemaphore_(expenses[1], date("2026-08-03")), FIN.SEMAPHORE.GREEN);
  assert.equal(context.calculateSemaphore_(expenses[4], date("2026-08-03")), FIN.SEMAPHORE.GREEN);
  assert.equal(expenses[2].Pago, FIN.NO);
  assert.equal(pendingCard.Pago, FIN.NO);
});

test("Fatura quitada do cartão não entra duas vezes no Resultado Atual", () => {
  const settledBill = movement({
    ID: "MOV-BILL-PAID", Tipo: FIN.TYPES.CARD_BILL, "Valor Planejado": 5237, "Valor Realizado": 5237,
    "Valor Pago": 5237, "Possui Vencimento": FIN.YES, "Data de Vencimento": date("2026-08-08"),
    "Data do Pagamento": date("2026-08-02"), Pago: FIN.YES,
  });
  const cardPurchase = movement({
    ID: "MOV-CARD-PAID", Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Planejado": 5237, "Valor Realizado": 5237,
  });
  const revenue = movement({
    ID: "MOV-REV-PAID", Tipo: FIN.TYPES.REVENUE, "Valor Realizado": 7600,
  });
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [settledBill, cardPurchase, revenue], 105, [], date("2026-08-03"));
  assert.equal(snapshot.plannedCost, 5237);
  assert.equal(snapshot.cardExpenses, 5237);
  assert.equal(snapshot.currentResult, 2363);
  assert.equal(snapshot.launches.length, 0);
  assert.equal(context.calculateSemaphore_(settledBill, date("2026-08-03")), FIN.SEMAPHORE.GREEN);
});

test("Fatura do cartão ainda não quitada mostra o realizado somado das compras, não um valor gravado avulso", () => {
  const openBill = movement({
    ID: "MOV-BILL-OPEN", Tipo: FIN.TYPES.CARD_BILL, "Valor Planejado": 5237, "Valor Realizado": 3471,
    "Possui Vencimento": FIN.YES, "Data de Vencimento": date("2026-08-08"), Pago: FIN.NO,
  });
  const cardPurchaseA = movement({ ID: "MOV-CARD-A", Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Realizado": 2000 });
  const cardPurchaseB = movement({ ID: "MOV-CARD-B", Tipo: FIN.TYPES.CARD_PURCHASE, "Valor Realizado": 1694 });
  const snapshot = context.calculateFinancialSnapshot_("2026-07", [openBill, cardPurchaseA, cardPurchaseB], 0, [], date("2026-08-03"));
  assert.equal(snapshot.cardExpenses, 3694, "soma das compras no cartão, não o valor avulso gravado na fatura");
  const billRow = snapshot.expenses.find((expense) => expense.id === "MOV-BILL-OPEN");
  assert.equal(billRow.realizedValue, 3694, "enquanto não quitada, a fatura exibe o realizado somado das compras");
});

console.log(`\n${passed} testes aprovados.`);
