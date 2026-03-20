// ============================================================
//  SDUCS – MK  |  AES-256-GCM File Encryption Utility
// ============================================================
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH = 16;   // 128 bits
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a per-file key from master key + fileId.
 * This means each file has a unique derived key.
 */
function deriveKey(masterKey, fileId) {
  return crypto.scryptSync(
    masterKey,
    fileId,
    KEY_LENGTH,
    { N: 16384, r: 8, p: 1 }
  );
}

/**
 * Encrypt a Buffer and return { encryptedBuffer, iv, authTag }
 */
function encryptBuffer(buffer, masterKey, fileId) {
  const key = deriveKey(masterKey, fileId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Prepend iv + authTag to the encrypted data for storage
  const result = Buffer.concat([iv, authTag, encrypted]);
  return {
    encryptedBuffer: result,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt a Buffer that was encrypted with encryptBuffer.
 */
function decryptBuffer(encryptedBuffer, masterKey, fileId) {
  const key = deriveKey(masterKey, fileId);

  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Create a SHA-256 hash of a buffer (for duplicate detection).
 */
function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate a secure random 6-digit access code.
 */
function generateAccessCode() {
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}

/**
 * Hash an access code for storage.
 */
function hashAccessCode(code) {
  return crypto.createHash("sha256")
    .update(code + process.env.ACCESS_CODE_PEPPER)
    .digest("hex");
}

/**
 * Verify an access code against its stored hash.
 */
function verifyAccessCode(code, storedHash) {
  const hash = hashAccessCode(code);
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

/**
 * Generate a secure share link token.
 */
function generateShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  hashBuffer,
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode,
  generateShareToken,
};
