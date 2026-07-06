import { describe, expect, it } from "vitest";
import { normalizeCompanyName, normalizeCorporateNumber, normalizePostalCode } from "../src/domain/normalize.js";

describe("normalization", () => {
  it.each([
    ["100-0001", "1000001"],
    ["１００－０００１", "1000001"],
    [" 100 0001 ", "1000001"]
  ])("normalizes postal code %s", (input, expected) => {
    expect(normalizePostalCode(input)).toBe(expected);
  });

  it("rejects invalid postal codes", () => {
    expect(normalizePostalCode("100001")).toBeNull();
    expect(normalizePostalCode("abcdefg")).toBeNull();
  });

  it("normalizes corporate numbers and names", () => {
    expect(normalizeCorporateNumber("１２３４-５６７８-９０１２３")).toBe("1234567890123");
    expect(normalizeCompanyName(" ＡＢＣ　株式会社 ")).toBe("ABC 株式会社");
  });
});
