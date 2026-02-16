const LEGAL_SUFFIX_PATTERN = /\b(llc|inc|co|ltd)\b/g;
const PUNCTUATION_PATTERN = /[^\w\s]/g;

export function normalizeEmail(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePhone(value?: string | null) {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits.length > 0 ? digits : null;
}

export function normalizeDomain(value?: string | null) {
  if (!value) {
    return null;
  }

  const fromEmail = value.includes("@") ? value.split("@")[1] : value;
  const withoutProtocol = fromEmail
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  const domain = withoutProtocol.split("/")[0].trim();

  return domain.length > 0 ? domain : null;
}

export function normalizeBusinessName(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .replace(PUNCTUATION_PATTERN, " ")
    .replace(LEGAL_SUFFIX_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCity(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeLeadPayload(input: {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  businessName?: string | null;
  city?: string | null;
}) {
  return {
    emailNorm: normalizeEmail(input.email),
    phoneNorm: normalizePhone(input.phone),
    domainNorm: normalizeDomain(input.email ?? input.website),
    nameNorm: normalizeBusinessName(input.businessName),
    cityNorm: normalizeCity(input.city),
  };
}
