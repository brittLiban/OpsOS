import {
  normalizeBusinessName,
  normalizeCity,
  normalizeDomain,
  normalizeEmail,
  normalizeLeadPayload,
  normalizePhone,
} from "@/lib/server/normalization";

describe("normalization", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  TEST@Example.COM ")).toBe("test@example.com");
  });

  it("normalizes phone and strips leading 1", () => {
    expect(normalizePhone("+1 (555) 444-3333")).toBe("5554443333");
  });

  it("normalizes domain", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
    expect(normalizeDomain("user@sub.example.com")).toBe("sub.example.com");
  });

  it("normalizes business name", () => {
    expect(normalizeBusinessName("Acme, LLC")).toBe("acme");
    expect(normalizeBusinessName("Example Co. Ltd")).toBe("example");
  });

  it("normalizes city", () => {
    expect(normalizeCity("  New York ")).toBe("new york");
  });

  it("normalizes lead payload", () => {
    expect(
      normalizeLeadPayload({
        email: "Lead@Acme.com ",
        phone: "(555) 111-2222",
        website: "https://www.acme.com",
        businessName: "Acme Inc.",
        city: "Austin",
      }),
    ).toEqual({
      emailNorm: "lead@acme.com",
      phoneNorm: "5551112222",
      domainNorm: "acme.com",
      nameNorm: "acme",
      cityNorm: "austin",
    });
  });
});
