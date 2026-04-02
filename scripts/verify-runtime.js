#!/usr/bin/env bun

import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { formatDoctorReport, getDoctorReport } from "../lib/doctor.js";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entrypoint = join(rootDir, "index.js");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function runCurrentSmokeCheck() {
  execFileSync("bun", [entrypoint, "--current"], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function main() {
  const report = getDoctorReport();
  log(formatDoctorReport(report, "Runtime verification"));

  if (!report.canRunCurrent) {
    log("  Skipping --current smoke check because Claude Code runtime was not fully discovered on this machine.");
    process.exit(0);
  }

  runCurrentSmokeCheck();
}

main();
