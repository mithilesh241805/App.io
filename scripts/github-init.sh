#!/bin/bash
# ============================================================
#  SDUCS – MK  |  GitHub Push Setup Script
#  Run this ONCE from the project root to initialize git
#  and push to your GitHub repo.
#
#  Usage:
#    chmod +x scripts/github-init.sh
#    ./scripts/github-init.sh https://github.com/YOUR_USERNAME/sducs-mk.git
# ============================================================

set -e

REPO_URL=$1

if [ -z "$REPO_URL" ]; then
  echo "❌ Usage: ./scripts/github-init.sh https://github.com/YOUR_USERNAME/sducs-mk.git"
  exit 1
fi

echo ""
echo "🚀 SDUCS-MK GitHub Initialization"
echo "=================================="
echo ""

# ── Check prerequisites ───────────────────────────────────────
command -v git  >/dev/null 2>&1 || { echo "❌ git not found. Install git first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node not found. Install Node.js first."; exit 1; }

# ── Initialize git repo ───────────────────────────────────────
if [ ! -d ".git" ]; then
  echo "📁 Initializing git repository..."
  git init
  git branch -M main
else
  echo "✅ Git already initialized."
fi

# ── Configure .gitignore check ────────────────────────────────
if [ -f ".gitignore" ]; then
  echo "✅ .gitignore found."
else
  echo "❌ .gitignore missing! Please check the project files."
  exit 1
fi

# ── Check no .env files will be committed ─────────────────────
echo ""
echo "🔒 Checking for sensitive files..."
if git ls-files --others --exclude-standard | grep -E "\.env$|\.env\." | grep -v "\.env\.template"; then
  echo "❌ WARNING: .env files detected! Check your .gitignore."
  exit 1
fi
echo "✅ No sensitive files detected."

# ── Create .env files from templates ─────────────────────────
echo ""
echo "📝 Setting up environment files..."

if [ ! -f "backend/.env" ] && [ -f "backend/.env.template" ]; then
  cp backend/.env.template backend/.env
  echo "✅ Created backend/.env from template — FILL THIS IN before running!"
fi

if [ ! -f "web/.env" ] && [ -f "web/.env.template" ]; then
  cp web/.env.template web/.env
  echo "✅ Created web/.env from template — FILL THIS IN before running!"
fi

# ── Install dependencies ──────────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo "📦 Installing web dependencies..."
cd web && npm install && cd ..

# ── Initial commit ────────────────────────────────────────────
echo ""
echo "💾 Creating initial commit..."
git add .
git status --short

git commit -m "🚀 Initial commit: SDUCS-MK Multitasking App

- Backend: Node.js + Express + MongoDB
- Web: React + Vite + Glassmorphism UI
- Flutter: Android app with AdMob + Razorpay
- Features: AES-256 encryption, AI storage, cloud sync
- CI/CD: GitHub Actions for all three platforms" 2>/dev/null || echo "Nothing new to commit."

# ── Add remote and push ───────────────────────────────────────
echo ""
echo "🔗 Adding remote origin: $REPO_URL"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "⬆️  Pushing to GitHub..."
git push -u origin main

echo ""
echo "════════════════════════════════════════"
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "🔜 NEXT STEPS:"
echo ""
echo "1. Add GitHub Secrets (see GITHUB_SECRETS_SETUP.md):"
echo "   → Go to: $REPO_URL/settings/secrets/actions"
echo ""
echo "2. Add GitHub Variables:"
echo "   → Go to: $REPO_URL/settings/variables/actions"
echo ""
echo "3. Fill in backend/.env with your real credentials"
echo ""
echo "4. To deploy, push to main branch:"
echo "   git push origin main"
echo ""
echo "5. To create an Android release:"
echo "   git tag v1.0.0 && git push origin v1.0.0"
echo ""
echo "📖 Full guide: GITHUB_SECRETS_SETUP.md"
echo "════════════════════════════════════════"
