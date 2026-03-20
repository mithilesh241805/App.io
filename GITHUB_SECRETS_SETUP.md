# 🔐 GitHub Secrets & Variables Setup Guide
# SDUCS – MK Multitasking

This file tells you exactly what to add to your GitHub repository
before the CI/CD workflows will work.

Go to: GitHub Repo → Settings → Secrets and variables → Actions

---

## 📋 SECRETS  (Settings → Secrets → New repository secret)
These are encrypted and never shown after saving.

### 🔒 Backend / Server
| Secret Name                  | Where to get it                                      | Example |
|------------------------------|------------------------------------------------------|---------|
| `JWT_SECRET`                 | Generate: `openssl rand -hex 64`                     | `a1b2c3...` (128 chars) |
| `ENCRYPTION_MASTER_KEY`      | Generate: `openssl rand -hex 32`                     | `a1b2c3...` (64 chars) |
| `ACCESS_CODE_PEPPER`         | Generate: `openssl rand -hex 16`                     | random string |
| `MONGODB_URI`                | MongoDB Atlas → Connect → Drivers                    | `mongodb+srv://...` |

### 🔥 Firebase (Admin SDK)
| Secret Name                  | Where to get it                                      |
|------------------------------|------------------------------------------------------|
| `FIREBASE_PRIVATE_KEY`       | Firebase Console → Project Settings → Service Accounts → Generate new private key → copy `private_key` field |
| `FIREBASE_CLIENT_EMAIL`      | Same JSON file → `client_email` field                |
| `GOOGLE_SERVICES_JSON`       | Firebase Console → Project Settings → Your apps → Android app → Download `google-services.json` → paste entire file content |

### 💳 Razorpay
| Secret Name                  | Where to get it                                      |
|------------------------------|------------------------------------------------------|
| `RAZORPAY_KEY_SECRET`        | Razorpay Dashboard → Settings → API Keys             |
| `RAZORPAY_WEBHOOK_SECRET`    | Razorpay Dashboard → Settings → Webhooks → your secret |

### 🌐 Firebase (Web App)
| Secret Name                         | Where to get it                               |
|-------------------------------------|-----------------------------------------------|
| `VITE_FIREBASE_API_KEY`             | Firebase Console → Project Settings → Web App config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same web app config                           |
| `VITE_FIREBASE_APP_ID`              | Same web app config                           |

### 🚀 Deployment
| Secret Name              | Where to get it                                            |
|--------------------------|------------------------------------------------------------|
| `RAILWAY_TOKEN`          | Railway.app → Account Settings → Tokens                   |
| `RENDER_DEPLOY_HOOK_URL` | Render.com → Your Service → Settings → Deploy Hook         |
| `VERCEL_TOKEN`           | Vercel.com → Account Settings → Tokens                     |
| `NETLIFY_AUTH_TOKEN`     | Netlify → User Settings → Personal access tokens           |
| `NETLIFY_SITE_ID`        | Netlify → Site settings → General → Site ID                |
| `VPS_HOST`               | Your VPS IP address                                        |
| `VPS_USER`               | SSH username (e.g. `ubuntu`)                               |
| `VPS_SSH_KEY`            | Your private SSH key (`cat ~/.ssh/id_rsa`)                 |

### 📱 Flutter / Android Signing
| Secret Name        | How to create it                                             |
|--------------------|--------------------------------------------------------------|
| `KEYSTORE_BASE64`  | `keytool -genkey -v -keystore release.jks -alias sducs-mk -keyalg RSA -keysize 2048 -validity 10000` then `base64 -w 0 release.jks` |
| `KEYSTORE_PASSWORD`| Password you set when creating the keystore                  |
| `KEY_PASSWORD`     | Key password (can be same as above)                          |
| `KEY_ALIAS`        | `sducs-mk` (or what you set)                                 |

### 🤖 AI
| Secret Name      | Where to get it                              |
|------------------|----------------------------------------------|
| `GEMINI_API_KEY` | https://aistudio.google.com → Get API Key    |

---

## 📋 VARIABLES  (Settings → Variables → New repository variable)
These are NOT encrypted but also not printed in logs.

| Variable Name              | Value                                      |
|----------------------------|--------------------------------------------|
| `BACKEND_URL`              | `https://api.yourdomain.com`               |
| `WEB_URL`                  | `https://yourdomain.com`                   |
| `BACKEND_API_URL`          | `https://api.yourdomain.com/api`           |
| `DEPLOY_TARGET`            | `railway` OR `render` OR `vercel` OR `netlify` OR `vps` |
| `RAILWAY_SERVICE`          | Your Railway service name (if using Railway) |
| `VITE_API_URL`             | `https://api.yourdomain.com/api`           |
| `VITE_FIREBASE_AUTH_DOMAIN`| `your-project.firebaseapp.com`             |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id`                          |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com`             |
| `FIREBASE_PROJECT_ID`      | `your-project-id`                          |
| `FIREBASE_STORAGE_BUCKET`  | `your-project.appspot.com`                 |
| `STATIC_UPI_ID`            | `8940091624@naviaxis`                      |
| `RAZORPAY_KEY_ID`          | `rzp_live_xxxxxxxxxxxx`                    |
| `STORAGE_PROVIDER`         | `firebase` or `s3`                         |

---

## ⚡ Quick Copy Commands

### Generate strong secrets locally:
```bash
# JWT Secret
openssl rand -hex 64

# Encryption Master Key
openssl rand -hex 32

# Access Code Pepper
openssl rand -hex 16

# Create Android signing keystore
keytool -genkey -v \
  -keystore release.jks \
  -alias sducs-mk \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_PASSWORD \
  -keypass YOUR_PASSWORD \
  -dname "CN=SDUCS-MK, OU=Mobile, O=YourOrg, L=City, S=State, C=IN"

# Base64 encode keystore for GitHub secret
base64 -w 0 release.jks | pbcopy   # macOS (copies to clipboard)
base64 -w 0 release.jks            # Linux (print to terminal)
```

---

## 🏁 Workflow Summary

After adding all secrets/variables, your GitHub Actions will:

| Trigger                    | What happens                                          |
|----------------------------|-------------------------------------------------------|
| Push to `main` (backend/)  | Test → Deploy backend to production                   |
| Push to `main` (web/)      | Build → Deploy web to Vercel/Netlify                  |
| Push to `main` (flutter/)  | Build release APKs → Upload as artifacts              |
| Push tag `v1.0.0`          | Build APK + AAB → Create GitHub Release with files    |
| Open Pull Request          | Run tests + security audit + preview deployment       |
| Every Monday 6 AM          | Run security audit + dependency vulnerability scan    |

---

## 🚀 First Deploy Checklist

- [ ] All SECRETS added to GitHub
- [ ] All VARIABLES added to GitHub
- [ ] `DEPLOY_TARGET` set to your chosen platform
- [ ] Firebase project created with Google Auth + Email Auth enabled
- [ ] MongoDB Atlas cluster created and IP whitelisted
- [ ] Razorpay account created (test keys first, then live)
- [ ] Domain configured and pointing to your server
- [ ] SSL certificate set up (Let's Encrypt recommended)
- [ ] Push to `main` branch → watch Actions tab for deployments
