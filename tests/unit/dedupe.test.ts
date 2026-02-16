import { isHardDuplicate, isSoftDuplicate, softDuplicateScore } from "@/lib/server/dedupe";

describe("dedupe", () => {
  it("detects hard duplicates by email/phone/domain", () => {
    expect(
      isHardDuplicate(
        { emailNorm: "a@a.com", phoneNorm: null, domainNorm: null },
        { emailNorm: "a@a.com", phoneNorm: null, domainNorm: null },
      ),
    ).toBe(true);
    expect(
      isHardDuplicate(
        { emailNorm: null, phoneNorm: "5551112222", domainNorm: null },
        { emailNorm: null, phoneNorm: "5551112222", domainNorm: null },
      ),
    ).toBe(true);
    expect(
      isHardDuplicate(
        { emailNorm: null, phoneNorm: null, domainNorm: "acme.com" },
        { emailNorm: null, phoneNorm: null, domainNorm: "acme.com" },
      ),
    ).toBe(true);
  });

  it("detects soft duplicates by name+city exact", () => {
    expect(
      isSoftDuplicate(
        { nameNorm: "acme services", cityNorm: "austin" },
        { nameNorm: "acme services", cityNorm: "austin" },
      ),
    ).toBe(true);
  });

  it("supports soft close match with jaro-winkler threshold", () => {
    expect(
      isSoftDuplicate(
        { nameNorm: "acme service", cityNorm: "austin" },
        { nameNorm: "acme services", cityNorm: "austin" },
      ),
    ).toBe(true);
  });

  it("returns score between 0 and 1", () => {
    const score = softDuplicateScore(
      { nameNorm: "alpha media", cityNorm: "dallas" },
      { nameNorm: "alpha media group", cityNorm: "dallas" },
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
