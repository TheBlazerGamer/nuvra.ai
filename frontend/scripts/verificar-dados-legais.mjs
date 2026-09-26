import { readFileSync } from "node:fs";

// Roda antes de publicar (deploy): falha se ainda houver campo [PREENCHER...] nos dados da empresa,
// para nunca ir ao ar uma política de privacidade ou termos incompletos.
const arquivo = new URL("../src/lib/empresa.ts", import.meta.url);
const linhas = readFileSync(arquivo, "utf-8").split("\n");

const pendentes = linhas
  .map((linha) => /^\s*(\w+):\s*"\[PREENCHER/.exec(linha))
  .filter(Boolean)
  .map((achado) => achado[1]);

if (pendentes.length > 0) {
  console.error(`Dados legais pendentes em src/lib/empresa.ts: ${pendentes.join(", ")}`);
  process.exit(1);
}
console.log("Dados legais completos.");
