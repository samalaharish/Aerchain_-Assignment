import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
const target = path.join(projectRoot, "runtime", "pdfjs", "pdf.worker.mjs");

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);

console.log(`Copied PDF.js worker to ${path.relative(projectRoot, target)}`);
