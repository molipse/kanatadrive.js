#!/bin/bash
# release.sh — KanataDrive
# Usage: ./release.sh 1.2
# Commits staged changes (if any), creates a git tag, pushes, purges jsDelivr cache.

set -e

# ── 1. Version argument ────────────────────────────────────────────────────────
VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh <version>   e.g. ./release.sh 1.2"
  exit 1
fi
TAG="v$VERSION"

# ── 2. Check for uncommitted changes and commit them ──────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "📦  Uncommitted changes found — staging and committing..."
  git add -A
  git commit -m "release: $TAG"
fi

# ── 3. Delete existing tag if it exists (local + remote) ──────────────────────
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "🗑   Removing existing tag $TAG..."
  git tag -d "$TAG"
  git push origin ":refs/tags/$TAG" 2>/dev/null || true
fi

# ── 4. Push main branch ────────────────────────────────────────────────────────
echo "⬆️   Pushing main..."
git push origin main

# ── 5. Create and push tag ────────────────────────────────────────────────────
echo "🏷   Creating tag $TAG..."
git tag "$TAG"
git push origin "$TAG"

# ── 6. Purge jsDelivr cache ───────────────────────────────────────────────────
REPO="molipse/kanatadrive.js"
FILES=(utils.js api.js cars.js filters.js favorites.js auth.js dashboard.js requests.js vin.js)

echo "🧹  Purging jsDelivr cache..."
for file in "${FILES[@]}"; do
  URL="https://purge.jsdelivr.net/gh/$REPO@$TAG/js/$file"
  STATUS=$(curl -s "$URL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "skipped")
  echo "    $file → $STATUS"
done

# ── 7. Print new CDN URLs ─────────────────────────────────────────────────────
echo ""
echo "✅  Done! Update Webflow script tags to:"
for file in "${FILES[@]}"; do
  echo "    https://cdn.jsdelivr.net/gh/$REPO@$TAG/js/$file"
done
echo ""
echo "💡  In Webflow: replace the old version tag in all <script src=...> with @$TAG"
