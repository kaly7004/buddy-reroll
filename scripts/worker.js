#!/usr/bin/env node
import { rollFrom, matches, setNodeHashMode } from "../lib/companion.js";

const SALT_LEN = 15;
const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const REPORT_INTERVAL = 100_000;

function randomSalt() {
  let s = "";
  for (let i = 0; i < SALT_LEN; i++) {
    s += CHARSET[(Math.random() * CHARSET.length) | 0];
  }
  return s;
}

const userId = process.argv[2];
let target;
try {
  target = JSON.parse(process.argv[3]);
} catch {
  process.stderr.write("Invalid target JSON\n");
  process.exit(1);
}

if (process.argv.includes("--node-hash")) setNodeHashMode(true);

if (!userId || !target) {
  process.stderr.write("Usage: worker.js <userId> '<targetJSON>'\n");
  process.exit(1);
}

const start = Date.now();
let attempts = 0;

for (;;) {
  attempts++;
  const salt = randomSalt();
  const result = rollFrom(salt, userId);

  if (matches(result, target)) {
    process.stdout.write(JSON.stringify({ salt, attempts, elapsed: Date.now() - start }));
    process.exit(0);
  }

  if (attempts % REPORT_INTERVAL === 0) {
    process.stderr.write(JSON.stringify({ attempts, elapsed: Date.now() - start }) + "\n");
  }
}
