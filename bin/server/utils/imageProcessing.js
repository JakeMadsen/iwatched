const sharp = require('sharp');
let fileType = null;
try { fileType = require('file-type'); } catch(_) { fileType = null; }

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
]);
const EXT_FOR_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

async function sniffMime(buf){
  try {
    if (fileType && typeof fileType.fromBuffer === 'function') {
      const res = await fileType.fromBuffer(buf);
      if (res && res.mime) return res.mime.toLowerCase();
    }
  } catch(_){}
  // naive fallback based on common signatures
  if (buf && buf.length >= 12) {
    // JPEG
    if (buf[0]===0xFF && buf[1]===0xD8 && buf[2]===0xFF) return 'image/jpeg';
    // PNG
    if (buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4E && buf[3]===0x47) return 'image/png';
    // WebP (RIFF....WEBP)
    if (buf[0]===0x52 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x46 && buf[8]===0x57 && buf[9]===0x45 && buf[10]===0x42 && buf[11]===0x50) return 'image/webp';
  }
  return null;
}

/**
 * Process an uploaded image buffer into a safe, compressed asset.
 * kind: 'picture' | 'banner'
 * options: { allowOriginal?: boolean }
 * Returns { buffer, contentType, ext }
 */
async function processProfileImage(inputBuffer, kind, options){
  if (!Buffer.isBuffer(inputBuffer)) throw Object.assign(new Error('No image data provided'), { code: 'no_data' });
  const mime = await sniffMime(inputBuffer);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    throw Object.assign(new Error('Unsupported image type. Allowed: JPG, PNG, WebP'), { code: 'invalid_type' });
  }
  const allowOriginal = !!(options && options.allowOriginal);

  // Admin/original bypass: keep original buffer + format
  if (allowOriginal) {
    const ext = EXT_FOR_MIME[mime] || 'bin';
    return { buffer: inputBuffer, contentType: mime, ext };
  }

  // Normalize and compress using WebP for good balance (browser support is wide)
  const isAvatar = (String(kind).toLowerCase() === 'picture');
  const target = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 12000 * 12000 });
  // Resize strategy
  if (isAvatar) {
    target.resize({ width: 512, height: 512, fit: 'cover', position: 'attention' });
  } else {
    // Banner: wide cover crop
    target.resize({ width: 1600, height: 400, fit: 'cover', position: 'attention' });
  }

  // Convert to webp
  const quality = isAvatar ? 82 : 80;
  const out = await target.webp({ quality, effort: 4 }).toBuffer();
  return { buffer: out, contentType: 'image/webp', ext: 'webp' };
}

module.exports = { processProfileImage, ALLOWED_MIME };
