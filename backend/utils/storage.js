// ============================================================
//  SDUCS – MK  |  Storage Utility (Firebase / S3 abstraction)
// ============================================================
const admin = require("./firebaseAdmin");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const PROVIDER = process.env.STORAGE_PROVIDER || "firebase"; // "firebase" | "s3"

// ── AWS S3 Client ─────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Firebase Storage bucket ───────────────────────────────────
const getBucket = () => admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

// ── Upload ────────────────────────────────────────────────────
async function uploadToStorage(buffer, key, contentType) {
  if (PROVIDER === "s3") {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }));
    return { storageKey: key, downloadURL: null };
  }

  // Firebase Storage
  const bucket = getBucket();
  const file = bucket.file(key);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  return { storageKey: key, downloadURL: null };
}

// ── Download ──────────────────────────────────────────────────
async function downloadFromStorage(key) {
  if (PROVIDER === "s3") {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  const bucket = getBucket();
  const [buffer] = await bucket.file(key).download();
  return buffer;
}

// ── Delete ────────────────────────────────────────────────────
async function deleteFromStorage(key) {
  if (PROVIDER === "s3") {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));
    return;
  }

  const bucket = getBucket();
  await bucket.file(key).delete({ ignoreNotFound: true });
}

// ── Get Signed URL (for direct client download) ───────────────
async function getSignedDownloadURL(key, expiresInSeconds = 3600) {
  if (PROVIDER === "s3") {
    return getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }), { expiresIn: expiresInSeconds });
  }

  const bucket = getBucket();
  const [url] = await bucket.file(key).getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return url;
}

module.exports = { uploadToStorage, downloadFromStorage, deleteFromStorage, getSignedDownloadURL };
