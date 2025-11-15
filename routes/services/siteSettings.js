const SiteSetting = require('../../db/models/siteSetting');

async function getNumber(key, fallback){
    try {
        const doc = await SiteSetting.findOne({ key }).lean();
        if (!doc || typeof doc.value === 'undefined' || doc.value === null) return fallback;
        const n = Number(doc.value);
        if (!isFinite(n) || n <= 0) return fallback;
        return Math.floor(n);
    } catch (_) {
        return fallback;
    }
}

module.exports = {
    getNumber
};

