# Remove Netlify-specific files
rm -f apps/web/netlify.toml apps/admin/netlify.toml
rm -rf apps/web/netlify apps/admin/netlify

# Vercel doesn't need them either
rm -f vercel.json apps/web/vercel.json apps/admin/vercel.json

# Commit the cleanup
git add -A
git commit -m "chore: remove Netlify configs in favor of Vercel"
git push origin main