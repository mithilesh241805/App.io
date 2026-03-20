# SDUCS – MK  |  Database Schema  (MongoDB)

---

## Collection: `users`

```
{
  uid:           String  (unique — Firebase UID)
  email:         String  (unique, lowercase)
  displayName:   String
  photoURL:      String
  provider:      "google" | "email"
  passwordHash:  String  (bcrypt, hidden in responses)
  isActive:      Boolean (default: true)
  isAdmin:       Boolean (default: false)
  emailVerified: Boolean
  lastLoginAt:   Date
  jwtVersion:    Number  (incremented on logout/pwd change)

  cloudStorage: {
    usedBytes:    Number  (default: 0)
    totalBytes:   Number  (default: 32212254720  = 30 GB)
    maxCapBytes:  Number  (default: 107374182400 = 100 GB)
  }

  downloadData: {
    usedBytes:    Number  (default: 0)
    totalBytes:   Number  (default: 10737418240  = 10 GB)
  }

  subscription: {
    plan:         "lite"|"premium"|"pro"|"promax"|"none"
    planLabel:    String
    dataGB:       Number
    expiresAt:    Date
    activatedAt:  Date
    transactionId:String
  }

  adRewards: {
    dailyAdsWatched:  Number
    dailyBytesEarned: Number
    lastResetDate:    String  (YYYY-MM-DD)
    totalAdsWatched:  Number
    totalBytesEarned: Number
  }

  fcmToken:     String
  platform:     "android"|"web"|"ios"
  createdAt:    Date
  updatedAt:    Date
}
```

**Indexes:** `email`, `uid`, `createdAt`

---

## Collection: `files`

```
{
  ownerId:          String   (Firebase UID)
  ownerEmail:       String
  originalName:     String
  storedName:       String   (unique — path in storage)
  mimeType:         String
  sizeBytes:        Number
  extension:        String
  category:         "image"|"video"|"audio"|"document"|"archive"|"other"

  storageProvider:  "firebase"|"s3"
  storageKey:       String
  downloadURL:      String?

  isEncrypted:      Boolean  (default: true)
  encryptionIV:     String   (hex)
  fileHash:         String   (SHA-256 of plaintext — for duplicate detection)
  accessCode:       String?  (plaintext, only set momentarily then cleared)
  accessCodeHash:   String?  (SHA-256 + pepper)

  isPublic:         Boolean  (default: false)
  shareLink:        String?
  shareLinkExpiresAt: Date?
  shareDownloadCount: Number
  shareDownloadLimit: Number  (default: 50)

  isDeleted:        Boolean  (default: false)
  deletedAt:        Date?
  permanentDeleteAt: Date?   (30 days after deletion)

  aiTags:           [String]
  aiDescription:    String?
  isDuplicate:      Boolean
  duplicateOf:      ObjectId?
  lastAccessedAt:   Date?
  accessCount:      Number

  createdAt:        Date
  updatedAt:        Date
}
```

**Indexes:** `ownerId+isDeleted`, `fileHash+ownerId`, `shareLink`, `permanentDeleteAt`

---

## Collection: `transactions`

```
{
  userId:       String   (Firebase UID)
  userEmail:    String

  plan:         "lite"|"premium"|"pro"|"promax"
  planLabel:    String
  dataGB:       Number
  amountINR:    Number
  durationDays: Number

  method:       "razorpay"|"upi_screenshot"
  status:       "pending"|"processing"|"success"|"failed"|"refunded"|"manual_review"

  razorpayOrderId:   String?
  razorpayPaymentId: String?
  razorpaySignature: String?
  qrCodeData:        String?  (base64 QR image)
  qrExpiresAt:       Date?

  screenshotUrl:     String?
  screenshotKey:     String?
  utrNumber:         String?
  adminNote:         String?
  verifiedBy:        String?
  verifiedAt:        Date?

  activatedAt:  Date?
  expiresAt:    Date?
  ipAddress:    String
  userAgent:    String
  failureReason:String?

  createdAt:    Date
  updatedAt:    Date
}
```

**Indexes:** `razorpayOrderId`, `razorpayPaymentId`, `status+createdAt`, `userId+status`

---

## Collection: `downloadjobs`

```
{
  userId:             String
  url:                String
  fileName:           String?
  mimeType:           String?
  sizeBytes:          Number?
  estimatedSizeBytes: Number?
  quality:            "best"|"1080p"|"720p"|"480p"|"360p"|"audio_only"|"original"

  status: "queued"|"detecting"|"downloading"|"paused"|"completed"|"failed"|"cancelled"

  progressBytes:   Number
  progressPercent: Number
  speedBps:        Number

  storageKey:      String?
  storageProvider: String?
  previewUrl:      String?
  errorMessage:    String?
  retryCount:      Number

  startedAt:   Date?
  completedAt: Date?
  fileId:      ObjectId?  (ref: files)

  createdAt:   Date
  updatedAt:   Date
}
```

---

## Storage Capacity Rules

| Event                          | Effect                                         |
|--------------------------------|------------------------------------------------|
| New user signup                | +30 GB cloudStorage.totalBytes                 |
| Rewarded ad watched            | +100MB to +500MB cloudStorage.totalBytes       |
| Daily ad cap reached           | No more rewards for the day (resets midnight)  |
| Plan purchased (any)           | +N GB downloadData.totalBytes                  |
| File uploaded to cloud         | +N bytes cloudStorage.usedBytes                |
| File permanently deleted       | -N bytes cloudStorage.usedBytes                |
| Download completed             | +N bytes downloadData.usedBytes                |
| Max storage cap                | 100 GB hard limit on cloudStorage.totalBytes   |

---

## Security Architecture

```
User Request
    │
    ├── JWT Middleware (verify token + jwtVersion)
    │      └── Firebase ID Token fallback
    │
    ├── Rate Limiter (200 req/15min global, 20 auth)
    │
    ├── File Upload
    │      ├── SHA-256 hash → duplicate check
    │      ├── scrypt KDF → per-file derived key
    │      ├── AES-256-GCM encrypt
    │      └── Upload to Firebase/S3
    │
    └── File Download
           ├── Owner check OR access code verify
           ├── Fetch from storage
           └── AES-256-GCM decrypt → stream to client
```
