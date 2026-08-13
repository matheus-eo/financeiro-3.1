import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs");
const filePath = path.join(outputDir, "Financeiro_3.1.xlsx");
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
const names = [
  "01 - Configurações", "02 - Receitas", "03 - Cadastro de Despesas",
  "04 - Movimentações", "05 - Categorias", "06 - Patrimônio",
  "07 - Histórico", "08 - Dashboard", "09 - Relatório WhatsApp",
];

for (const name of names) {
  const preview = await workbook.render({ sheetName: name, autoCrop: "all", scale: 1, format: "png" });
  const safeName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "_");
  await fs.writeFile(path.join(outputDir, `${safeName}.png`), new Uint8Array(await preview.arrayBuffer()));
}
console.log(`Renderizadas ${names.length} abas.`);
