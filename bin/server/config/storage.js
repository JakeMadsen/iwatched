/*
 Simple storage helper for S3‑compatible object stores (e.g., Fly.io Tigris).
 Falls back to disabled mode if env not provided.
*/

const AWS = require('aws-sdk');

function buildS3() {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || '';
  const accessKeyId = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'auto';
  const bucket = process.env.S3_BUCKET || process.env.BUCKET_NAME || '';
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return { enabled: false };
  }
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    region,
    endpoint: new AWS.Endpoint(endpoint),
    s3ForcePathStyle: true, // best compatibility with custom endpoints
    signatureVersion: 'v4'
  });
  return { enabled: true, s3, bucket };
}

module.exports = {
  /**
   * Upload a Buffer to the configured S3 bucket under the given key.
   * @param {string} key - Object key in the bucket
   * @param {Buffer|Uint8Array} body - File data
   * @param {string} contentType - MIME type
   */
  async putObject(key, body, contentType) {
    const cfg = buildS3();
    if (!cfg.enabled) throw new Error('S3 storage not configured');
    await cfg.s3.putObject({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType, ACL: 'private' }).promise();
    return { bucket: cfg.bucket, key };
  },

  /**
   * Remove an object if it exists; ignore not found.
   */
  async deleteObject(key) {
    const cfg = buildS3();
    if (!cfg.enabled) return false;
    try {
      await cfg.s3.deleteObject({ Bucket: cfg.bucket, Key: key }).promise();
      return true;
    } catch (_) { return false; }
  },

  /**
   * Stream an object to an HTTP response. Returns false if not configured.
   */
  streamToResponse(req, res, key, headers = {}) {
    const cfg = buildS3();
    if (!cfg.enabled) return false;
    try {
      const stream = cfg.s3.getObject({ Bucket: cfg.bucket, Key: key }).createReadStream();
      Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
      stream.on('error', (err) => {
        try {
          if (err && (err.code === 'NoSuchKey' || err.statusCode === 404)) {
            return res.status(404).end();
          }
        } catch (_) {}
        try { res.status(500).end(); } catch (_) {}
      });
      stream.pipe(res);
      return true;
    } catch (e) {
      try { res.status(500).end(); } catch (_) {}
      return true; // handled
    }
  },

  /**
   * Whether S3 storage is enabled via env vars
   */
  isEnabled() { return buildS3().enabled; },
  bucketName() { const cfg = buildS3(); return cfg.enabled ? cfg.bucket : null; }
  ,
  /**
   * List objects by prefix (S3-only). Returns [{ key, size, lastModified }]
   */
  async list(prefix, maxKeys = 200) {
    const cfg = buildS3();
    if (!cfg.enabled) return [];
    const out = [];
    let token = undefined;
    do {
      const res = await cfg.s3.listObjectsV2({ Bucket: cfg.bucket, Prefix: prefix || '', ContinuationToken: token, MaxKeys: Math.min(1000, maxKeys) }).promise();
      (res.Contents || []).forEach(o => { out.push({ key: o.Key, size: o.Size, lastModified: o.LastModified }); });
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
      if (out.length >= maxKeys) break;
    } while (token);
    return out;
  }
}
