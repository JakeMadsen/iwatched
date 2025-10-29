const BAD_PATTERNS = [
  /bitcoin|crypto|binance|coinbase|usdt/i,
  /guest\s*post|backlinks?|seo\b|indexing\s*domains?/i,
  /jagomail|mailgun|sendgrid|mailer/i,
  /claim\s+(your|fund|transfer)/i,
  /graph\.org|t\.me\/|bit\.ly|tinyurl|goo\.gl/i
];

function countLinks(s){
  const m = String(s||'').match(/https?:\/\//gi); return m ? m.length : 0;
}

function evaluateContact({ title, text, email }){
  const reasons = [];
  const t = (String(title||'') + ' ' + String(text||''));
  // Obvious patterns
  for (const rx of BAD_PATTERNS){ if (rx.test(t)) { reasons.push('pattern:' + rx.toString()); break; } }
  // Too many links
  if (countLinks(t) >= 2) reasons.push('too_many_links');
  // Non-latin heavy messages (optional heuristic)
  try {
    const ascii = (t.match(/[\x00-\x7F]/g)||[]).length; const total = t.length || 1; const ratio = ascii/total;
    if (total > 40 && ratio < 0.5) reasons.push('nonlatin_heavy');
  } catch(_){}
  // Suspicious domains in email
  if (/jagomail|tempmail|guerrillamail|10minutemail/i.test(String(email||''))) reasons.push('disposable_email');

  return { isSpam: reasons.length > 0, reason: reasons.join(',') || null };
}

module.exports = { evaluateContact };

