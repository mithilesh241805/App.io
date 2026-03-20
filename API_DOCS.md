# SDUCS – MK Multitasking  |  API Documentation  v1.0.0

Base URL: `https://your-api.com/api`
All protected endpoints require: `Authorization: Bearer <JWT_TOKEN>`

---

## 🔐 Authentication  `/api/auth`

### POST `/auth/register`
Register new user with email + password.
**Body:** `{ email, password, displayName }`
**Response 201:** `{ token, user }`

### POST `/auth/login`
Login with email + password.
**Body:** `{ email, password }`
**Response 200:** `{ token, user }`

### POST `/auth/google`
Exchange Firebase ID token for our JWT.
**Body:** `{ idToken: <Firebase ID Token> }`
**Response 200:** `{ token, user }`

### GET `/auth/me` 🔒
Get current authenticated user's profile.
**Response 200:** `{ uid, email, displayName, cloudStorage, downloadData, subscription, adRewards }`

### POST `/auth/logout` 🔒
Invalidate all existing JWT tokens for user.
**Response 200:** `{ message }`

### POST `/auth/change-password` 🔒
**Body:** `{ currentPassword, newPassword }`
**Response 200:** `{ message }`

---

## 📁 File Management  `/api/files`

### POST `/files/upload` 🔒
Upload a file. Auto-detects type, encrypts AES-256, checks duplicates.
**Content-Type:** `multipart/form-data`
**Field:** `file` (binary)
**Response 201:** `{ message, file: { id, name, size, category, mimeType, createdAt } }`
**Error 409:** Duplicate file detected → `{ duplicate: true, existingFileId, existingFileName }`
**Error 413:** Insufficient storage

### GET `/files` 🔒
List user's files with filtering.
**Query:** `?page=1&limit=50&category=image&search=photo&deleted=false`
**Response 200:** `{ files[], total, page, pages }`

### GET `/files/stats` 🔒
Get storage and download data usage statistics.
**Response 200:**
```json
{
  "storage": { "used": 0, "total": 0, "max": 0, "percent": "0.0" },
  "downloadData": { "used": 0, "total": 0, "percent": "0.0" },
  "byCategory": [{ "_id": "image", "totalSize": 0, "count": 0 }]
}
```

### GET `/files/duplicates` 🔒
Find exact duplicate files using SHA-256 hash comparison.
**Response 200:** `{ groups[], count }`

### GET `/files/:id/download` 🔒
Download and decrypt a file.
**Query:** `?code=123456` (required for shared files not owned by user)
**Response 200:** Binary file stream with `Content-Disposition` header.

### POST `/files/:id/share` 🔒
Generate a share link.
**Body:** `{ expiresIn: 24, generateCode: true }`  (expiresIn in hours)
**Response 200:** `{ shareLink, expiresAt, accessCode? }`
> ⚠️ Access code shown only once. Store it immediately.

### DELETE `/files/:id` 🔒
Move to recycle bin (default) or permanently delete.
**Query:** `?permanent=true` for hard delete (only works on deleted files)
**Response 200:** `{ message, permanentDeleteAt? }`

### POST `/files/:id/restore` 🔒
Restore a file from the recycle bin.
**Response 200:** `{ message }`

---

## ⬇️ Download Manager  `/api/downloads`

### POST `/downloads/detect`  🔒
Probe a URL to detect file type and size (no download occurs).
**Body:** `{ url }`
**Response 200:**
```json
{
  "fileName": "video.mp4",
  "mimeType": "video/mp4",
  "estimatedSize": 52428800,
  "category": "video",
  "icon": "🎬",
  "hasQualityOptions": true
}
```

### POST `/downloads/start` 🔒
Queue a download. Downloads are processed asynchronously.
**Body:** `{ url, quality? }` (quality: "best" | "1080p" | "720p" | "480p" | "360p" | "audio_only" | "original")
**Response 201:** `{ jobId, message }`
**Error 402:** Insufficient download data → upgrade required

### GET `/downloads` 🔒
Get download history.
**Response 200:** `{ jobs[] }`

### GET `/downloads/:id` 🔒
Get status of a specific download job.
**Response 200:** `{ status, progressPercent, speedBps, sizeBytes, ... }`

### DELETE `/downloads/:id` 🔒
Cancel or remove a download job.
**Response 200:** `{ message }`

---

## 💳 Payments  `/api/payments`

### POST `/payments/create-order` 🔒
Create a Razorpay order + UPI QR code.
**Body:** `{ plan: "lite" | "premium" | "pro" | "promax" }`
**Response 200:**
```json
{
  "orderId": "order_xxx",
  "transactionId": "...",
  "amount": 49,
  "qrCode": "data:image/png;base64,...",
  "qrExpiresAt": "2024-01-01T00:00:00Z",
  "razorpayKeyId": "rzp_xxx",
  "plan": { "label": "Premium", "dataGB": 10, "price": 49, "days": 4 }
}
```

### POST `/payments/verify` 🔒
Verify Razorpay payment signature and activate plan.
**Body:** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
**Response 200:** `{ message, transaction }`

### POST `/payments/webhook`
Razorpay webhook endpoint (auto-credits on `payment.captured`).
**Header:** `x-razorpay-signature` (HMAC-SHA256 of body)

### POST `/payments/upi-fallback/initiate` 🔒
Generate UPI QR for manual payment (static UPI ID not exposed as text).
**Body:** `{ plan }`
**Response 200:** `{ transactionId, qrCode, instructions[] }`

### POST `/payments/upi-fallback/submit` 🔒
Submit payment screenshot for admin verification.
**Content-Type:** `multipart/form-data`
**Fields:** `transactionId, screenshot (file), utrNumber?`
**Response 200:** `{ message, status: "manual_review" }`

### GET `/payments/history` 🔒
Get user's payment history.
**Response 200:** `{ transactions[] }`

---

## 📺 Ad Rewards  `/api/ads`

### POST `/ads/initiate` 🔒
Request a one-time ad token before showing the ad.
**Response 200:** `{ token, estimatedRewardMB, adUnitId }`
**Error 429:** Daily limit reached

### POST `/ads/complete` 🔒
Claim reward after ad is fully watched.
**Body:** `{ token, rewardType: "storage" | "download" }`
**Response 200:**
```json
{
  "message": "🎉 You earned 250 MB!",
  "rewardMB": 250,
  "rewardType": "storage",
  "dailyAdsWatched": 3,
  "dailyRemaining": 7
}
```
**Error 400:** Token invalid/expired or ad completed too quickly (bot detection)

### GET `/ads/status` 🔒
Get daily ad status and limits.
**Response 200:**
```json
{
  "canWatch": true,
  "dailyAdsWatched": 3,
  "dailyAdsLimit": 10,
  "dailyBytesEarned": 524288000,
  "dailyBytesLimit": 2147483648,
  "estimatedRewardRange": { "minMB": 100, "maxMB": 500 }
}
```

---

## 🤖 AI Features  `/api/ai`

### POST `/ai/categorize-file` 🔒
AI-powered file categorization + smart tags.
**Body:** `{ fileId }`
**Response 200:** `{ tags[], description, isLikelyUnused, optimizationTip }`

### POST `/ai/storage-optimization` 🔒
Analyze storage and get AI recommendations.
**Response 200:** `{ summary, storageScore, recommendations[], cleanupCandidates[] }`

### POST `/ai/smart-duplicate-detect` 🔒
Detect both exact and near-duplicates using AI.
**Response 200:** `{ exactDuplicates, exactGroups[], nearDuplicateGroups[] }`

### POST `/ai/chat` 🔒
Chat with AI assistant about file management.
**Body:** `{ message }`
**Response 200:** `{ reply }`

---

## 🛡️ Admin Panel  `/api/admin`  (Admin only)

### GET `/admin/stats`
Dashboard stats: users, files, payments, revenue.

### GET `/admin/users?page=1&search=email`
Paginated user list with optional search.

### PATCH `/admin/users/:uid`
**Body:** `{ isActive?, isAdmin?, addStorageGB?, addDataGB? }`

### GET `/admin/pending-payments`
List all UPI screenshot submissions awaiting verification.

### POST `/payments/admin/approve` 🔒 (Admin)
Approve or reject a manual payment.
**Body:** `{ transactionId, action: "approve"|"reject", note? }`

### GET `/admin/revenue`
Revenue breakdown by plan and daily revenue chart (last 30 days).

---

## 📦 Subscription Plans

| Plan    | Data  | Price | Validity | Plan ID  |
|---------|-------|-------|----------|----------|
| Lite    | 5 GB  | ₹25   | 2 days   | `lite`   |
| Premium | 10 GB | ₹49   | 4 days   | `premium`|
| Pro     | 20 GB | ₹99   | 6 days   | `pro`    |
| Pro Max | 50 GB | ₹200  | 8 days   | `promax` |

---

## ❗ Error Codes

| Code | Meaning |
|------|---------|
| 400  | Bad request / validation error |
| 401  | Unauthenticated – invalid/missing token |
| 402  | Payment required (quota exceeded) |
| 403  | Forbidden – insufficient permissions |
| 404  | Resource not found |
| 409  | Conflict (e.g., duplicate file, email exists) |
| 413  | Payload too large (storage quota exceeded) |
| 429  | Rate limited or daily ad limit reached |
| 500  | Internal server error |

---

## 🔒 Security Notes

- All files encrypted with **AES-256-GCM** before storage
- Per-file derived encryption keys using **scrypt KDF**
- JWT tokens contain version for instant global logout
- Ad rewards use one-time tokens with 15-second minimum watch time
- Access codes are **SHA-256 hashed** with pepper before storage
- UPI ID (`STATIC_UPI_ID`) never exposed in API responses — only encoded in QR
- All endpoints rate-limited at 200 req/15min globally, 20/15min for auth
