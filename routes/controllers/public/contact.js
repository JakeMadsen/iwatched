const Message = require('../../../db/models/contactMessages')
const axios = require('axios');
const { createMemoryLimiter } = require('../../../bin/server/utils/rateLimit');
const { evaluateContact } = require('../../../bin/server/utils/antiSpam');

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/contact', async (req, res) => {
        // If user is logged in, redirect to Support area as requested
        if (req.user) {
            return res.redirect('/support');
        }
        try { req.session.contactFormTs = Date.now(); } catch(_){}

        const reSite = process.env.RECAPTCHA_SITE_KEY || null;
        const hSite = process.env.HCAPTCHA_SITE_KEY || null;
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "contact",
            page_data: {
                message: false,
                captcha: reSite ? { provider: 'recaptcha', sitekey: reSite }
                                : (hSite ? { provider: 'hcaptcha', sitekey: hSite } : null)
            },
            user: req.user
        });
    });

    const rateLimit = createMemoryLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
    server.post('/contact', rateLimit, async (req, res) => {
        var newMessage = new Message()
        newMessage.initial(req.body);
        console.log("message", newMessage)

        // Honeypot
        const honeypot = (req.body && (req.body.website || req.body.homepage || req.body.url)) || '';
        let isSpam = false; let spamReason = '';
        if (honeypot && String(honeypot).trim() !== '') { isSpam = true; spamReason = 'honeypot'; }
        // Timing check (min 3s from GET)
        try { const ts = Number(req.session.contactFormTs||0); if (!isSpam && ts && (Date.now()-ts) < 3000) { isSpam = true; spamReason = (spamReason?spamReason+',':'') + 'too_fast'; } } catch(_){}
        // Content heuristics
        try { const ev = evaluateContact({ title: newMessage.title, text: newMessage.text, email: newMessage.email }); if (ev.isSpam){ isSpam = true; spamReason = (spamReason?spamReason+',':'') + ev.reason; } } catch(_){}
        // hCaptcha/Recaptcha (optional)
        try {
            const hasRe = !!process.env.RECAPTCHA_SECRET;
            const hasHc = !!process.env.HCAPTCHA_SECRET;
            const tokenRe = req.body['g-recaptcha-response'];
            const tokenHc = req.body['h-captcha-response'];
            let provider = null; let token = null; let secret = null; let url = null;
            if (tokenRe && hasRe) { provider = 'recaptcha'; token = tokenRe; secret = process.env.RECAPTCHA_SECRET; url = 'https://www.google.com/recaptcha/api/siteverify'; }
            else if (tokenHc && hasHc) { provider = 'hcaptcha'; token = tokenHc; secret = process.env.HCAPTCHA_SECRET; url = 'https://hcaptcha.com/siteverify'; }
            else if ((hasRe || hasHc) && !tokenRe && !tokenHc) {
                // Captcha configured but no token provided
                isSpam = true; spamReason = (spamReason?spamReason+',':'') + 'captcha_missing';
            }
            if (provider && token && secret && !isSpam) {
                const params = new URLSearchParams(); params.append('secret', secret); params.append('response', token); params.append('remoteip', req.ip||'');
                const vr = await axios.post(url, params);
                const ok = !!(vr && vr.data && (vr.data.success===true));
                if (!ok) { isSpam = true; spamReason = (spamReason?spamReason+',':'') + 'captcha_failed'; }
            }
        } catch(_) { /* ignore network errors but do not block */ }

        // Attach metadata
        try {
            newMessage.is_spam = !!isSpam;
            newMessage.spam_reason = spamReason || null;
            newMessage.ip = (req.headers['x-forwarded-for'] || req.ip || '').toString();
            newMessage.ua = (req.headers['user-agent'] || '').toString();
        } catch(_){}

        newMessage.save((error, message) => {
            res.render('public assets/template.ejs', {
                page_title: "iWatched - Home",
                page_file: "contact",
                page_data: {
                    message: message
                },
                user: req.user
            });

        })
    });
}
