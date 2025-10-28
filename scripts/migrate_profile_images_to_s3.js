#!/usr/bin/env node

// Upload existing local profile images to S3 with the same key layout
// so URLs like /static/style/img/profile_images/users/:id/:file keep working

// Load local env if present
try { require('dotenv').config(); } catch (_) {}

const fs = require('fs');
const path = require('path');
const storage = require('../bin/server/config/storage');

async function run() {
  if (!storage || !storage.isEnabled || !storage.isEnabled()) {
    console.error('[migrate] S3 storage not configured. Set env S3/AWS vars.');
    process.exit(1);
  }
  const base = path.join(__dirname, '..', 'public', 'style', 'img', 'profile_images', 'users');
  if (!fs.existsSync(base)) {
    console.log('[migrate] Nothing to migrate. Directory missing:', base);
    return;
  }
  let uploaded = 0, skipped = 0, failed = 0;
  const userIds = fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  for (const uid of userIds) {
    const dir = path.join(base, uid);
    const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
    for (const f of files) {
      const key = `style/img/profile_images/users/${uid}/${f}`;
      try {
        const data = fs.readFileSync(path.join(dir, f));
        const ext = (f.split('.').pop() || '').toLowerCase();
        const type = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : (ext === 'gif' ? 'image/gif' : 'image/jpeg'));
        await storage.putObject(key, data, type);
        uploaded++;
        process.stdout.write('.');
      } catch (e) {
        failed++;
        console.error(`\n[migrate] Failed ${key}:`, e && e.message ? e.message : e);
      }
    }
  }
  console.log(`\n[migrate] Done. Uploaded: ${uploaded}, Failed: ${failed}, Skipped: ${skipped}`);
}

run().catch((e) => { console.error('[migrate] Fatal:', e); process.exit(1); });
