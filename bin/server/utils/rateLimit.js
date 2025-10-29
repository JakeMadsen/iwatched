function createMemoryLimiter({ windowMs = 60 * 1000, max = 10 } = {}) {
  const store = new Map(); // ip -> { count, resetAt }
  function cleanup() {
    const now = Date.now();
    for (const [ip, v] of store.entries()) {
      if (!v || v.resetAt <= now) store.delete(ip);
    }
  }
  setInterval(cleanup, Math.max(1000, Math.floor(windowMs / 2))).unref();

  return function rateLimit(req, res, next) {
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || '').toString();
      const now = Date.now();
      const rec = store.get(ip) || { count: 0, resetAt: now + windowMs };
      if (rec.resetAt <= now) { rec.count = 0; rec.resetAt = now + windowMs; }
      rec.count += 1; store.set(ip, rec);
      if (rec.count > max) {
        res.setHeader('Retry-After', Math.ceil((rec.resetAt - now)/1000));
        return res.status(429).send('Too many requests');
      }
      next();
    } catch (_) { next(); }
  }
}

module.exports = { createMemoryLimiter };

