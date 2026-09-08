<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-workflow -->

# Deployment Workflow (WAJIB DIIKUTI)

## VPS
- **Host:** `root@187.127.118.188`
- **Source code aktif:** `/home/projects/mudah-bikin-aplikasi` (SELALU up-to-date)
- **Domain:** `mudahbikinapps.store`
- **Service:** Container Docker dikelola Coolify

## Cara Deploy (STANDAR)

Setelah selesai edit code di lokal Mac:

```bash
# 1. Commit perubahan
git add -A && git commit -m "feat/fix: deskripsi singkat"

# 2. Push ke VPS (UTAMA) → otomatis build + Coolify redeploy
git push vps main

# 3. Push ke GitHub (backup)
git push origin main
```

## Apa yang terjadi saat `git push vps main`:
1. Hook `/home/git/mudah-bikin-aplikasi.git/hooks/post-receive` berjalan
2. Code di-checkout ke `/home/projects/mudah-bikin-aplikasi`
3. `npm run build` dijalankan di sana
4. Coolify API di-trigger untuk rebuild container

## LARANGAN
- JANGAN edit file di Vercel atau deploy ke Vercel — aplikasi HANYA di VPS
- JANGAN skip `git push vps main` — harus selalu VPS yang paling update
- JANGAN rebuild container Coolify manual tanpa push code dulu

<!-- END:deployment-workflow -->
