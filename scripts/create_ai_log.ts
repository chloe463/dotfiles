#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cwd = process.cwd();

const today = new Date();
const year = today.getFullYear();
const month = `${(today.getMonth() + 1).toString().padStart(2, "0")}`;
const day = `${today.getDate().toString().padStart(2, "0")}`;
const date = `${year}${month}${day}`;

const title = process.argv[2];
if (!title) {
  console.error("Error: Title is required.");
  process.exit(1);
}

const logDirPath = join(cwd, "./.ai_logs", `${year}`, `${month}`);

if (!existsSync(logDirPath)) {
  mkdirSync(logDirPath, { recursive: true });
}

const logFilePath = join(logDirPath, `${date}_${title.replace(/ /g, "_")}.md`);
console.log(`Creating log file: ${logFilePath}`);

// "wx" fails instead of truncating, so an existing log is never wiped.
try {
  writeFileSync(logFilePath, "", { flag: "wx" });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  console.error(`Error: ${logFilePath} already exists.`);
  process.exit(1);
}

console.log("Log file created successfully.");
process.exit(0);
