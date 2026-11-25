import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexSource = readFileSync(join(root, "src/index.js"), "utf8");
const opsSource = readFileSync(join(root, "src/ops.js"), "utf8");

const index = indexSource.replace(/^import \{ handleOps \} from "\.\/ops\.js";\n/m, "");
if (index === indexSource) {
  throw new Error("Could not strip the ops import from src/index.js");
}

const importRe = /^import \{[\s\S]*?\} from "\.\/index\.js";\n/m;
const opsNoImport = opsSource.replace(importRe, "");
if (opsNoImport === opsSource) {
  throw new Error("Could not strip the index import from src/ops.js");
}
const ops = opsNoImport.replace(/^export async function handleOps/m, "async function handleOps");
if (ops === opsNoImport) {
  throw new Error("Could not rewrite the handleOps export");
}

const outDir = join(root, "artifacts");
mkdirSync(outDir, { recursive: true });
const out = `${index}\n${ops}\n`;
const dest = join(outDir, "worker.js");
writeFileSync(dest, out);
process.stdout.write(`Wrote artifacts/worker.js (${out.length} bytes)\n`);
