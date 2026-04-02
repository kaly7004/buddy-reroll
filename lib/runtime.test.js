import { describe, it, expect } from "bun:test";
import { resolveClaudeExecutable, getClaudeBinaryOverride, getClaudeConfigDir, getPatchability } from "./runtime.js";
import { writeFileSync, mkdirSync, rmSync, chmodSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeTempDir() {
  const dir = join(realpathSync(tmpdir()), `buddy-reroll-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("getClaudeConfigDir", () => {
  it("returns ~/.claude by default", () => {
    const original = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
    const result = getClaudeConfigDir();
    expect(result).toMatch(/\.claude$/);
    if (original) process.env.CLAUDE_CONFIG_DIR = original;
  });

  it("respects CLAUDE_CONFIG_DIR env var", () => {
    const original = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = "/custom/path";
    expect(getClaudeConfigDir()).toBe("/custom/path");
    if (original) process.env.CLAUDE_CONFIG_DIR = original;
    else delete process.env.CLAUDE_CONFIG_DIR;
  });
});

describe("getClaudeBinaryOverride", () => {
  it("returns null when not set", () => {
    const original = process.env.CLAUDE_BINARY_PATH;
    delete process.env.CLAUDE_BINARY_PATH;
    expect(getClaudeBinaryOverride()).toBeNull();
    if (original) process.env.CLAUDE_BINARY_PATH = original;
  });

  it("returns trimmed path when set", () => {
    const original = process.env.CLAUDE_BINARY_PATH;
    process.env.CLAUDE_BINARY_PATH = "  /some/path  ";
    expect(getClaudeBinaryOverride()).toBe("/some/path");
    if (original) process.env.CLAUDE_BINARY_PATH = original;
    else delete process.env.CLAUDE_BINARY_PATH;
  });
});

describe("resolveClaudeExecutable", () => {
  it("returns null for non-existent path", () => {
    expect(resolveClaudeExecutable("/nonexistent/path")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveClaudeExecutable("")).toBeNull();
    expect(resolveClaudeExecutable(null)).toBeNull();
  });

  it("returns path for large files (real binary)", () => {
    const dir = makeTempDir();
    const fakeBinary = join(dir, "claude");
    writeFileSync(fakeBinary, Buffer.alloc(2_000_000));
    expect(resolveClaudeExecutable(fakeBinary)).toBe(fakeBinary);
    rmSync(dir, { recursive: true });
  });

  it("follows shell exec wrapper to real binary", () => {
    const dir = makeTempDir();
    const realBinary = join(dir, "claude-real");
    const wrapper = join(dir, "claude");
    writeFileSync(realBinary, Buffer.alloc(2_000_000));
    writeFileSync(wrapper, `#!/bin/sh\nexec "${realBinary}" "$@"\n`);
    chmodSync(wrapper, 0o755);
    expect(resolveClaudeExecutable(wrapper)).toBe(realBinary);
    rmSync(dir, { recursive: true });
  });

  it("prevents infinite loops via cycle detection", () => {
    const dir = makeTempDir();
    const a = join(dir, "a");
    const b = join(dir, "b");
    writeFileSync(a, `#!/bin/sh\nexec "${b}" "$@"\n`);
    writeFileSync(b, `#!/bin/sh\nexec "${a}" "$@"\n`);
    chmodSync(a, 0o755);
    chmodSync(b, 0o755);
    expect(resolveClaudeExecutable(a)).toBeNull();
    rmSync(dir, { recursive: true });
  });
});

describe("getPatchability", () => {
  it("returns ok for writable file", () => {
    const dir = makeTempDir();
    const file = join(dir, "claude");
    writeFileSync(file, "data");
    const result = getPatchability(file);
    expect(result.ok).toBe(true);
    expect(result.backupPath).toBe(`${file}.backup`);
    rmSync(dir, { recursive: true });
  });

  it("returns not ok for missing path", () => {
    const result = getPatchability(null);
    expect(result.ok).toBe(false);
  });

  it("returns not ok for non-existent file", () => {
    const result = getPatchability("/nonexistent/file");
    expect(result.ok).toBe(false);
  });
});
