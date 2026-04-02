import { describe, it, expect } from "bun:test";
import { wyhash } from "./wyhash.js";

describe("wyhash", () => {
  it("matches Bun.hash for empty string", () => {
    expect(wyhash(0n, "")).toBe(BigInt(Bun.hash("")));
  });

  it("matches Bun.hash for short strings", () => {
    const cases = ["a", "ab", "abc", "hello", "hello world"];
    for (const s of cases) {
      expect(wyhash(0n, s)).toBe(BigInt(Bun.hash(s)));
    }
  });

  it("matches Bun.hash for companion-realistic inputs", () => {
    const salts = ["friend-2026-401", "friend-2026-abc", "xxxxxxxxxxxxxxx"];
    const userIds = ["anon", "fd50b3fd-1234-5678-9abc-def012345678"];
    for (const uid of userIds) {
      for (const salt of salts) {
        const key = uid + salt;
        expect(wyhash(0n, key)).toBe(BigInt(Bun.hash(key)));
      }
    }
  });

  it("matches Bun.hash for long strings (>48 bytes)", () => {
    const long = "a".repeat(100);
    expect(wyhash(0n, long)).toBe(BigInt(Bun.hash(long)));
  });

  it("matches Bun.hash for unicode strings", () => {
    const cases = ["한글", "αβγδ", "🎮🐉✨"];
    for (const s of cases) {
      expect(wyhash(0n, s)).toBe(BigInt(Bun.hash(s)));
    }
  });

  it("returns bigint", () => {
    expect(typeof wyhash(0n, "test")).toBe("bigint");
  });

  it("is deterministic", () => {
    expect(wyhash(0n, "test")).toBe(wyhash(0n, "test"));
  });

  it("produces different output for different inputs", () => {
    expect(wyhash(0n, "hello")).not.toBe(wyhash(0n, "world"));
  });
});
