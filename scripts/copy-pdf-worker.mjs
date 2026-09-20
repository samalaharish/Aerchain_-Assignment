import { copyFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const workerSource = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
const workerTarget = path.join(projectRoot, "runtime", "pdfjs", "pdf.worker.mjs");
const standardFontsSource = path.join(packageRoot, "standard_fonts");
const standardFontsTarget = path.join(projectRoot, "runtime", "pdfjs", "standard_fonts");

await mkdir(path.dirname(workerTarget), { recursive: true });
await copyFile(workerSource, workerTarget);
await cp(standardFontsSource, standardFontsTarget, { recursive: true, force: true });

console.log(`Copied PDF.js worker to ${path.relative(projectRoot, workerTarget)}`);
console.log(`Copied PDF.js standard fonts to ${path.relative(projectRoot, standardFontsTarget)}`);
