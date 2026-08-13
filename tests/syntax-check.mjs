import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src");
const files = (await fs.readdir(sourceDir)).filter((file) => file.endsWith(".gs")).sort();

for (const file of files) {
  const source = await fs.readFile(path.join(sourceDir, file), "utf8");
  new vm.Script(source, { filename: file });
  console.log(`PASS sintaxe: ${file}`);
}

console.log(`\n${files.length} arquivos Apps Script analisados sem erro de sintaxe.`);
