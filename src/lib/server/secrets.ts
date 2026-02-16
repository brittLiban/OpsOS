import crypto from "node:crypto";

const SECRET_VERSION = "v1";
const IV_LENGTH = 12;

function getEncryptionPassphrase() {
  return process.env.OPSOS_SECRET_ENCRYPTION_KEY ?? null;
}

function deriveKey(passphrase: string) {
  return crypto.createHash("sha256").update(passphrase).digest();
}

export function isSecretEncryptionConfigured() {
  return Boolean(getEncryptionPassphrase());
}

export function encryptSecretValue(plainText: string) {
  const passphrase = getEncryptionPassphrase();
  if (!passphrase) {
    throw new Error("OPSOS_SECRET_ENCRYPTION_KEY is not configured");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${SECRET_VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecretValue(cipherText: string) {
  const passphrase = getEncryptionPassphrase();
  if (!passphrase) {
    throw new Error("OPSOS_SECRET_ENCRYPTION_KEY is not configured");
  }

  const [version, ivB64, authTagB64, encryptedB64] = cipherText.split(":");
  if (version !== SECRET_VERSION || !ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted secret format");
  }

  const key = deriveKey(passphrase);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function toSecretHint(secret: string) {
  if (!secret || secret.length < 4) {
    return "****";
  }
  return `****${secret.slice(-4)}`;
}
