import { describe, expect, it } from "vitest";

import en from "./en.json";
import zh from "./zh.json";

/**
 * Key-parity guard: TS types only validate call sites against zh.json, so a
 * key missing from en.json would compile silently and render the key itself
 * for English users. This test flattens both dictionaries and fails on any
 * key present in one but not the other, or on empty values.
 */
function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Array<[string, unknown]> {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return flatten(value as Record<string, unknown>, path);
    }
    return [[path, value]] as Array<[string, unknown]>;
  });
}

describe("locale key parity", () => {
  const zhEntries = flatten(zh);
  const enEntries = flatten(en);
  const zhKeys = zhEntries.map(([k]) => k).sort();
  const enKeys = enEntries.map(([k]) => k).sort();

  it("zh.json and en.json have identical key sets", () => {
    expect(zhKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !zhKeys.includes(k))).toEqual([]);
  });

  it("no empty translation values", () => {
    for (const [dict, entries] of [
      ["zh", zhEntries],
      ["en", enEntries],
    ] as const) {
      const empties = entries
        .filter(([, v]) => typeof v === "string" && v.trim() === "")
        .map(([k]) => `${dict}:${k}`);
      expect(empties).toEqual([]);
    }
  });
});
