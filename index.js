#!/usr/bin/env bun
// buddy-reroll — Reroll your Claude Code companion to any combo you want.
// Requires Bun (uses Bun.hash which matches Claude Code's internal hash).

import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import { execSync } from "child_process";
import { parseArgs } from "util";
import * as p from "@clack/prompts";

// ── Constants (must match Claude Code internals) ──────────────────────────

const ORIGINAL_SALT = "friend-2026-401";
const SALT_LEN = ORIGINAL_SALT.length; // 15

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

const SPECIES = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
];

const EYES = ["·", "✦", "×", "◉", "@", "°"];

const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"];

const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];

const RARITY_LABELS = {
  common: "Common (60%)",
  uncommon: "Uncommon (25%)",
  rare: "Rare (10%)",
  epic: "Epic (4%)",
  legendary: "Legendary (1%)",
};

// ── PRNG (Mulberry32 — matches Claude Code) ───────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rollRarity(rng) {
  let roll = rng() * 100;
  for (const r of RARITIES) {
    roll -= RARITY_WEIGHTS[r];
    if (roll < 0) return r;
  }
  return "common";
}

function rollFrom(salt, userId) {
  const rng = mulberry32(hashString(userId + salt));
  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const hat = rarity === "common" ? "none" : pick(rng, HATS);
  const shiny = rng() < 0.01;

  const RARITY_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 };
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);
  const stats = {};
  for (const name of STAT_NAMES) {
    if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    else if (name === dump) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    else stats[name] = floor + Math.floor(rng() * 40);
  }

  return { rarity, species, eye, hat, shiny, stats };
}

// ── Path detection ────────────────────────────────────────────────────────

function resolveSymlink(filePath) {
  try {
    const resolved = execSync(`readlink "${filePath}" 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (resolved && existsSync(resolved)) return resolved;
  } catch {}
  return filePath;
}

function findBinaryPath() {
  // Find all `claude` in PATH, skip shell wrappers, resolve symlinks
  try {
    const allPaths = execSync("which -a claude 2>/dev/null", { encoding: "utf-8" }).trim().split("\n");
    for (const p of allPaths) {
      const resolved = resolveSymlink(p.trim());
      if (resolved && existsSync(resolved) && statSync(resolved).size > 1_000_000) return resolved;
    }
  } catch {}

  // Fallback: ~/.local/share/claude/versions/<latest>
  const versionsDir = join(homedir(), ".local", "share", "claude", "versions");
  if (existsSync(versionsDir)) {
    try {
      const versions = readdirSync(versionsDir).sort();
      if (versions.length > 0) return join(versionsDir, versions[versions.length - 1]);
    } catch {}
  }

  return null;
}

function findConfigPath() {
  const home = homedir();
  const legacyPath = join(home, ".claude", ".config.json");
  if (existsSync(legacyPath)) return legacyPath;
  const defaultPath = join(home, ".claude.json");
  if (existsSync(defaultPath)) return defaultPath;
  return null;
}

function getUserId(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  return config.oauthAccount?.accountUuid ?? config.userID ?? "anon";
}

// ── Salt detection ────────────────────────────────────────────────────────
// The salt appears in the JS bundle inside the binary as a quoted string.
// Instead of relying on minified variable names (which change per build),
// we search for any 15-byte ASCII string that, when used as a salt with
// the user's ID, reproduces the companion roll stored in config — or falls
// back to known patterns.

function findCurrentSalt(binaryData) {
  // 1. Try the original salt
  if (binaryData.includes(Buffer.from(ORIGINAL_SALT))) return ORIGINAL_SALT;

  // 2. Try to find a previously patched salt by scanning for known patterns
  //    Our patches use "xxxxxxx" prefix or "friend-2026-" prefix
  const patterns = [/xxxxxxx\d{8}/, /friend-2026-.{3}/];
  const text = binaryData.toString("utf-8");
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[0].length === SALT_LEN) return m[0];
  }

  // 3. Generic scan: look for the salt near the PRNG/companion code markers.
  //    Search for strings near "friend-" or near "Mulberry" or "rollRarity"
  //    that are exactly SALT_LEN printable ASCII chars inside quotes.
  const saltRegex = /"([a-zA-Z0-9_-]{15})"/g;
  const candidates = new Set();
  let match;
  // Narrow the search to regions near companion-related strings
  const markers = ["rollRarity", "CompanionBones", "inspirationSeed", "mulberry32"];
  for (const marker of markers) {
    const markerIdx = text.indexOf(marker);
    if (markerIdx === -1) continue;
    // Search in a ±5000 char window around the marker
    const windowStart = Math.max(0, markerIdx - 5000);
    const windowEnd = Math.min(text.length, markerIdx + 5000);
    const window = text.slice(windowStart, windowEnd);
    while ((match = saltRegex.exec(window)) !== null) {
      candidates.add(match[1]);
    }
  }

  // Test each candidate: the one that produces a valid companion roll is our salt
  if (candidates.size > 0) {
    // We can't verify without userId, but return the first plausible one
    for (const c of candidates) {
      if (c.length === SALT_LEN) return c;
    }
  }

  return null;
}

// ── Brute-force ───────────────────────────────────────────────────────────

function bruteForce(userId, target, spinner) {
  const startTime = Date.now();
  let checked = 0;

  // Phase 1: "friend-2026-XXX" pattern (262K combinations)
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  const suffixLen = SALT_LEN - "friend-2026-".length;
  if (suffixLen > 0 && suffixLen <= 4) {
    const gen = function* (prefix, depth) {
      if (depth === 0) { yield prefix; return; }
      for (const ch of chars) yield* gen(prefix + ch, depth - 1);
    };
    for (const suffix of gen("", suffixLen)) {
      const salt = `friend-2026-${suffix}`;
      checked++;
      const r = rollFrom(salt, userId);
      if (matches(r, target)) return { salt, result: r, checked, elapsed: Date.now() - startTime };
    }
  }

  // Phase 2: "xxxxxxxNNNNNNNN" pattern (up to 1B)
  for (let i = 0; i < 1_000_000_000; i++) {
    const salt = String(i).padStart(SALT_LEN, "x");
    if (salt.length !== SALT_LEN) continue;
    checked++;
    const r = rollFrom(salt, userId);
    if (matches(r, target)) return { salt, result: r, checked, elapsed: Date.now() - startTime };

    if (checked % 5_000_000 === 0) {
      const secs = ((Date.now() - startTime) / 1000).toFixed(1);
      if (spinner) spinner.message(`${(checked / 1e6).toFixed(0)}M salts checked (${secs}s)`);
    }
  }

  return null;
}

function matches(roll, target) {
  if (target.species && roll.species !== target.species) return false;
  if (target.rarity && roll.rarity !== target.rarity) return false;
  if (target.eye && roll.eye !== target.eye) return false;
  if (target.hat && roll.hat !== target.hat) return false;
  if (target.shiny !== undefined && roll.shiny !== target.shiny) return false;
  return true;
}

// ── Binary patch ──────────────────────────────────────────────────────────

function patchBinary(binaryPath, oldSalt, newSalt) {
  if (oldSalt.length !== newSalt.length) {
    throw new Error(`Salt length mismatch: "${oldSalt}" (${oldSalt.length}) vs "${newSalt}" (${newSalt.length})`);
  }

  const data = readFileSync(binaryPath);
  const oldBuf = Buffer.from(oldSalt);
  const newBuf = Buffer.from(newSalt);

  let count = 0;
  let idx = 0;
  while (true) {
    idx = data.indexOf(oldBuf, idx);
    if (idx === -1) break;
    newBuf.copy(data, idx);
    count++;
    idx += newBuf.length;
  }

  if (count === 0) throw new Error(`Salt "${oldSalt}" not found in binary`);

  writeFileSync(binaryPath, data);
  return count;
}

function resignBinary(binaryPath) {
  if (platform() !== "darwin") return false;
  try {
    execSync(`codesign -s - --force "${binaryPath}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

function clearCompanion(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  delete config.companion;
  delete config.companionMuted;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ── Display helpers ───────────────────────────────────────────────────────

function formatRoll(result) {
  const lines = [];
  lines.push(`  ${result.species} / ${result.rarity} / eye:${result.eye} / hat:${result.hat}${result.shiny ? " / ✨ shiny" : ""}`);
  for (const [k, v] of Object.entries(result.stats)) {
    const bar = "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
    lines.push(`  ${k.padEnd(10)} ${bar} ${String(v).padStart(3)}`);
  }
  return lines.join("\n");
}

// ── Interactive mode ──────────────────────────────────────────────────────

async function interactiveMode(binaryPath, configPath, userId) {
  p.intro("buddy-reroll");

  const binaryData = readFileSync(binaryPath);
  const currentSalt = findCurrentSalt(binaryData);
  if (!currentSalt) {
    p.cancel("Could not find companion salt in binary.");
    process.exit(1);
  }
  const currentRoll = rollFrom(currentSalt, userId);
  p.note(formatRoll(currentRoll), "Current companion");

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "reroll", label: "Reroll companion", hint: "pick species, rarity, etc." },
      { value: "restore", label: "Restore original", hint: "undo all patches" },
      { value: "current", label: "Show current", hint: "just display info" },
    ],
  });
  if (p.isCancel(action)) { p.cancel(); process.exit(0); }

  if (action === "current") {
    p.outro("Done!");
    return;
  }

  if (action === "restore") {
    const backupPath = binaryPath + ".backup";
    if (!existsSync(backupPath)) {
      p.cancel("No backup found. Nothing to restore.");
      process.exit(1);
    }
    copyFileSync(backupPath, binaryPath);
    resignBinary(binaryPath);
    clearCompanion(configPath);
    p.outro("Restored! Restart Claude Code and run /buddy.");
    return;
  }

  // ── Reroll flow ──

  const species = await p.select({
    message: "Species",
    options: SPECIES.map((s) => ({
      value: s,
      label: s,
      hint: s === currentRoll.species ? "current" : undefined,
    })),
    initialValue: currentRoll.species,
  });
  if (p.isCancel(species)) { p.cancel(); process.exit(0); }

  const rarity = await p.select({
    message: "Rarity",
    options: RARITIES.map((r) => ({
      value: r,
      label: RARITY_LABELS[r],
      hint: r === currentRoll.rarity ? "current" : undefined,
    })),
    initialValue: currentRoll.rarity,
  });
  if (p.isCancel(rarity)) { p.cancel(); process.exit(0); }

  const eye = await p.select({
    message: "Eye",
    options: EYES.map((e) => ({
      value: e,
      label: e,
      hint: e === currentRoll.eye ? "current" : undefined,
    })),
    initialValue: currentRoll.eye,
  });
  if (p.isCancel(eye)) { p.cancel(); process.exit(0); }

  let hat = "none";
  if (rarity === "common") {
    p.log.info("Common rarity always gets hat=none");
  } else {
    hat = await p.select({
      message: "Hat",
      options: HATS.filter((h) => h !== "none").map((h) => ({
        value: h,
        label: h,
        hint: h === currentRoll.hat ? "current" : undefined,
      })),
      initialValue: currentRoll.hat === "none" ? "crown" : currentRoll.hat,
    });
    if (p.isCancel(hat)) { p.cancel(); process.exit(0); }
  }

  const shiny = await p.confirm({
    message: "Shiny?",
    initialValue: false,
  });
  if (p.isCancel(shiny)) { p.cancel(); process.exit(0); }

  const target = { species, rarity, eye, hat, shiny };

  // Check if already matching
  if (matches(currentRoll, target)) {
    p.outro("Already matching! No changes needed.");
    return;
  }

  // Preview target
  p.log.info(`Target: ${species} / ${rarity} / eye:${eye} / hat:${hat}${shiny ? " / ✨ shiny" : ""}`);

  const confirm = await p.confirm({
    message: "Search and apply?",
  });
  if (p.isCancel(confirm) || !confirm) { p.cancel(); process.exit(0); }

  // ── Search ──
  const spinner = p.spinner();
  spinner.start("Searching for matching salt...");

  const found = bruteForce(userId, target, spinner);
  if (!found) {
    spinner.stop("No matching salt found. Try relaxing constraints.");
    process.exit(1);
  }
  spinner.stop(`Found in ${found.checked.toLocaleString()} attempts (${(found.elapsed / 1000).toFixed(1)}s)`);

  p.note(formatRoll(found.result), "New companion");

  // ── Apply ──
  const backupPath = binaryPath + ".backup";
  if (!existsSync(backupPath)) {
    copyFileSync(binaryPath, backupPath);
    p.log.info(`Backup saved to ${backupPath}`);
  }

  const patchCount = patchBinary(binaryPath, currentSalt, found.salt);
  p.log.success(`Patched ${patchCount} occurrence(s)`);

  if (resignBinary(binaryPath)) {
    p.log.success("Binary re-signed (ad-hoc codesign)");
  }

  clearCompanion(configPath);
  p.log.success("Companion data cleared");

  p.outro("Done! Restart Claude Code and run /buddy to hatch your new companion.");
}

// ── Non-interactive mode ──────────────────────────────────────────────────

function nonInteractiveMode(args, binaryPath, configPath, userId) {
  console.log(`  Binary:  ${binaryPath}`);
  console.log(`  Config:  ${configPath}`);
  console.log(`  User ID: ${userId.slice(0, 8)}...`);

  if (args.current) {
    const binaryData = readFileSync(binaryPath);
    const currentSalt = findCurrentSalt(binaryData) ?? ORIGINAL_SALT;
    const result = rollFrom(currentSalt, userId);
    console.log(`\n  Current companion (salt: ${currentSalt}):`);
    console.log(formatRoll(result));
    console.log();
    return;
  }

  if (args.restore) {
    const backupPath = binaryPath + ".backup";
    if (!existsSync(backupPath)) {
      console.error("  ✗ No backup found at", backupPath);
      process.exit(1);
    }
    copyFileSync(backupPath, binaryPath);
    resignBinary(binaryPath);
    clearCompanion(configPath);
    console.log("  ✓ Restored. Restart Claude Code and run /buddy.");
    return;
  }

  // Build target from flags
  const target = {};
  if (args.species) {
    if (!SPECIES.includes(args.species)) { console.error(`  ✗ Unknown species "${args.species}". Use --list.`); process.exit(1); }
    target.species = args.species;
  }
  if (args.rarity) {
    if (!RARITIES.includes(args.rarity)) { console.error(`  ✗ Unknown rarity "${args.rarity}". Use --list.`); process.exit(1); }
    target.rarity = args.rarity;
  }
  if (args.eye) {
    if (!EYES.includes(args.eye)) { console.error(`  ✗ Unknown eye "${args.eye}". Use --list.`); process.exit(1); }
    target.eye = args.eye;
  }
  if (args.hat) {
    if (!HATS.includes(args.hat)) { console.error(`  ✗ Unknown hat "${args.hat}". Use --list.`); process.exit(1); }
    target.hat = args.hat;
  }
  if (args.shiny !== undefined) target.shiny = args.shiny;

  if (Object.keys(target).length === 0) {
    console.error("  ✗ Specify at least one target. Use --help for usage.");
    process.exit(1);
  }

  console.log(`  Target:  ${Object.entries(target).map(([k, v]) => `${k}=${v}`).join(" ")}\n`);

  const binaryData = readFileSync(binaryPath);
  const currentSalt = findCurrentSalt(binaryData);
  if (!currentSalt) {
    console.error("  ✗ Could not find companion salt in binary.");
    process.exit(1);
  }

  const currentRoll = rollFrom(currentSalt, userId);
  if (matches(currentRoll, target)) {
    console.log("  ✓ Already matches!\n" + formatRoll(currentRoll));
    return;
  }

  console.log("  Searching...");
  const found = bruteForce(userId, target, null);
  if (!found) {
    console.error("  ✗ No matching salt found. Try relaxing constraints.");
    process.exit(1);
  }
  console.log(`  ✓ Found in ${found.checked.toLocaleString()} attempts (${(found.elapsed / 1000).toFixed(1)}s)`);
  console.log(formatRoll(found.result));

  const backupPath = binaryPath + ".backup";
  if (!existsSync(backupPath)) {
    copyFileSync(binaryPath, backupPath);
    console.log(`\n  Backup:  ${backupPath}`);
  }

  const patchCount = patchBinary(binaryPath, currentSalt, found.salt);
  console.log(`  Patched: ${patchCount} occurrence(s)`);
  if (resignBinary(binaryPath)) console.log("  Signed:  ad-hoc codesign ✓");
  clearCompanion(configPath);
  console.log("  Config:  companion data cleared");
  console.log("\n  Done! Restart Claude Code and run /buddy.\n");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { values: args } = parseArgs({
    options: {
      species: { type: "string" },
      rarity: { type: "string" },
      eye: { type: "string" },
      hat: { type: "string" },
      shiny: { type: "boolean", default: undefined },
      list: { type: "boolean", default: false },
      restore: { type: "boolean", default: false },
      current: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  if (args.help) {
    console.log(`
  buddy-reroll — Reroll your Claude Code companion

  Usage:
    bunx buddy-reroll                  Interactive mode (recommended)
    bunx buddy-reroll --species dragon --rarity legendary --eye ✦ --shiny
    bunx buddy-reroll --list           Show all available options
    bunx buddy-reroll --current        Show current companion
    bunx buddy-reroll --restore        Restore original binary

  Flags (all optional — omit to leave random):
    --species <name>    ${SPECIES.join(", ")}
    --rarity <name>     ${RARITIES.join(", ")}
    --eye <char>        ${EYES.join(" ")}
    --hat <name>        ${HATS.join(", ")}
    --shiny / --no-shiny
`);
    return;
  }

  if (args.list) {
    console.log("\n  buddy-reroll — available options\n");
    console.log("  Species:  ", SPECIES.join(", "));
    console.log("  Rarity:   ", RARITIES.map((r) => `${r} (${RARITY_WEIGHTS[r]}%)`).join(", "));
    console.log("  Eye:       " + EYES.join("  "));
    console.log("  Hat:      ", HATS.join(", "));
    console.log("  Shiny:     true / false (1% natural chance)\n");
    console.log("  Notes:");
    console.log("  - common rarity always gets hat=none");
    console.log("  - more constraints = longer search time");
    console.log("  - shiny + legendary + specific species can take ~30s\n");
    return;
  }

  // ── Detect paths ──
  const binaryPath = findBinaryPath();
  if (!binaryPath) {
    console.error("✗ Could not find Claude Code binary. Is it installed?");
    process.exit(1);
  }

  const configPath = findConfigPath();
  if (!configPath) {
    console.error("✗ Could not find Claude Code config file.");
    process.exit(1);
  }

  const userId = getUserId(configPath);

  // If no target flags given → interactive mode
  const hasTargetFlags = args.species || args.rarity || args.eye || args.hat || args.shiny !== undefined;
  const isCommand = args.restore || args.current;

  if (!hasTargetFlags && !isCommand) {
    await interactiveMode(binaryPath, configPath, userId);
  } else {
    nonInteractiveMode(args, binaryPath, configPath, userId);
  }
}

main();
