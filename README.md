# SDUCS – MK Multitasking  🚀

**A full-stack cloud storage + download manager + ad monetization platform**

Android (Flutter) · Web (React + Vite) · Backend (Node.js + Express + MongoDB)

---

## 📦 Project Structure

```
sducs-mk/
├── backend/               Node.js + Express API
│   ├── server.js          Entry point
│   ├── routes/            auth, files, downloads, payments, ads, ai, admin
│   ├── models/            User, File, Transaction, DownloadJob
│   ├── middleware/        auth.js (JWT + Firebase dual mode)
│   ├── utils/             encryption.js, storage.js, firebaseAdmin.js
│   ├── jobs/              recycleBinCleanup.js, subscriptionExpiry.js
│   ├── .env.template      Environment variables template
│   └── package.json
│
├── web/                   React + Vite web app
│   ├── src/
│   │   ├── pages/         Auth, Dashboard, FileManager, Plans, Payment, ...
│   │   ├── components/    Layout (sidebar + topbar)
│   │   ├── context/       AuthContext, ThemeContext, ToastContext
│   │   └── utils/         api.js (axios), firebase.js
│   ├── .env.template
│   └── package.json
│
├── flutter/               Flutter Android app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/       auth, dashboard, file_manager, downloads, plans
│   │   ├── services/      auth_service, storage_service, ad_service
│   │   ├── models/        user_model.dart
│   │   └── utils/         app_theme.dart
│   └── pubspec.yaml
│
├── API_DOCS.md            Complete API reference
├── DATABASE_SCHEMA.md     MongoDB schema + architecture
└── README.md              This file
```

---

## ⚡ Quick Start

### 1. Backend

```bash
cd backend
cp .env.template .env
# Fill in all values in .env

npm install
npm run dev         # Development (nodemon)
npm start           # Production
```

### 2. Web App

```bash
cd web
cp .env.template .env
# Fill in Firebase config values

npm install
npm run dev         # http://localhost:3000
npm run build       # Production build → dist/
```

### 3. Flutter (Android)

```bash
cd flutter
# Update lib/services/auth_service.dart — set kApiBase to your backend URL
# Update android/app/google-services.json with your Firebase config

flutter pub get
flutter run                     # Debug on connected device
flutter build apk --release     # Build release APK
flutter build apk --split-per-abi  # Smaller per-ABI APKs
```

---

## 🔧 Required Services Setup

### Firebase
1. Create project at https://console.firebase.google.com
2. Enable **Authentication** → Google + Email/Password
3. Enable **Storage** (or use AWS S3 instead)
4. Download `google-services.json` → place in `flutter/android/app/`
5. Get Admin SDK credentials → copy to backend `.env`

### MongoDB Atlas
1. Create cluster at https://cloud.mongodb.com
2. Create database user
3. Whitelist your server IP
4. Copy connection string to `MONGODB_URI` in `.env`

### Razorpay
1. Create account at https://razorpay.com
2. Get Test Keys from Dashboard
3. Set up Webhook URL: `https://your-api.com/api/payments/webhook`
4. Add webhook secret to `.env`

### Google AdMob
1. Create app at https://admob.google.com
2. Create Rewarded + Interstitial ad units
3. Add App ID to `flutter/android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data
     android:name="com.google.android.gms.ads.APPLICATION_ID"
     android:value="ca-app-pub-xxxxx~yyyyy"/>
   ```
4. Replace test ad unit IDs in `flutter/lib/services/auth_service.dart`

### Gemini AI
1. Get API key from https://aistudio.google.com
2. Add to `GEMINI_API_KEY` in `.env`

---

## 💡 Feature Overview

| Feature                   | Status | Notes |
|---------------------------|--------|-------|
| Firebase Google Auth      | ✅     | Primary login method |
| Email/Password Auth       | ✅     | Secondary |
| AES-256-GCM File Encryption | ✅   | Per-file derived keys |
| Duplicate Detection       | ✅     | SHA-256 hash comparison |
| Cloud Storage (Firebase)  | ✅     | Swappable with S3 |
| 30 GB Signup Bonus        | ✅     | Auto-applied on register |
| Recycle Bin (30-day)      | ✅     | Cron job auto-purge |
| Ad Rewards (100–500 MB)   | ✅     | Daily cap: 2GB, 10 ads |
| Razorpay QR + Checkout    | ✅     | Auto-verified via webhook |
| UPI Screenshot Fallback   | ✅     | Admin manual verification |
| Download Manager          | ✅     | Async with quota deduction |
| AI Storage Optimization   | ✅     | Gemini 1.5 Flash |
| AI Duplicate Detection    | ✅     | Near-duplicate via LLM |
| Share Links + 6-digit Code | ✅    | AES-256 protected |
| Dark/Light Mode           | ✅     | Persisted to localStorage |
| Admin Panel               | ✅     | Revenue, users, approvals |

---

## 📱 APK Build Commands

```bash
# Debug APK (for testing)
flutter build apk --debug

# Release APK (optimized, ~20-30% smaller)
flutter build apk --release

# Split APKs by ABI (smallest downloads from Play Store)
flutter build apk --split-per-abi --release

# App Bundle for Play Store
flutter build appbundle --release
```

Output location: `flutter/build/app/outputs/flutter-apk/`

---

## 🔒 Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value (min 64 chars)
- [ ] Set `ENCRYPTION_MASTER_KEY` (min 32 chars, store securely)
- [ ] Set `ACCESS_CODE_PEPPER` (random string)
- [ ] Set `RAZORPAY_WEBHOOK_SECRET`
- [ ] Never commit `.env` to Git — add to `.gitignore`
- [ ] Enable MongoDB Atlas IP whitelist
- [ ] Set `ALLOWED_ORIGINS` to your production domain only
- [ ] Set `NODE_ENV=production` in production
- [ ] The `STATIC_UPI_ID` is NEVER returned in any API response — only QR-encoded

---

## 💰 Monetization Model

```
Revenue Sources:
├── Subscription Plans   ₹25–₹200 per purchase
│     ├── Lite    ₹25  (2 days, 5 GB)
│     ├── Premium ₹49  (4 days, 10 GB)
│     ├── Pro     ₹99  (6 days, 20 GB)
│     └── Pro Max ₹200 (8 days, 50 GB)
│
└── AdMob Rewarded Ads   ₹0.20–₹2 per view (India eCPM)
      ├── Max 10 ads/user/day
      ├── Max 2 GB rewards/day
      └── Users motivated to watch (earn storage)

Estimated Monthly Revenue (1000 DAU):
  Ads: 1000 users × 5 ads × ₹0.50 avg × 30 days = ₹75,000
  Plans: 10% conversion × ₹100 avg × 1000 = ₹10,000
  Total est: ~₹85,000/month
```

---

## 🌐 Deployment

### Backend (e.g. Railway / Render / EC2)
```bash
npm start
# Set PORT, NODE_ENV=production, and all .env vars
```

### Web (e.g. Vercel / Netlify)
```bash
npm run build
# Deploy dist/ folder
# Set VITE_API_URL to production backend URL
```

### Android
- Upload APK/AAB to Google Play Console
- Set up in-app billing if extending plans via Play

---

## 📞 Support

For issues, customizations, or deployment help:
- Create an issue in the project repository
- Check `API_DOCS.md` for complete endpoint reference
- Check `DATABASE_SCHEMA.md` for schema details
