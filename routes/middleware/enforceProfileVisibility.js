const UserFriends = require('../../db/models/userFriends');

module.exports = async function enforceProfileVisibility(req, res, next){
  try{
    const owner = res.locals.user;
    if (!owner) return next();
    const visibility = (owner.profile && owner.profile.visibility) || (owner.profile && owner.profile.private ? 'private' : 'public');

    // Always allow owner
    if (req.user && String(req.user._id) === String(owner._id)) return next();

    if (visibility === 'public') return next();
    if (visibility === 'private') {
      // block non-owners
      return res.status(403).render('public assets/template.ejs', {
        page_title: 'Profile is Private',
        page_file: 'error',
        page_data: { error: { status: 403, message: 'This profile is private.' } },
        user: req.user
      });
    }
    if (visibility === 'friends') {
      if (!req.user) {
        return res.status(403).render('public assets/template.ejs', {
          page_title: 'Friends Only',
          page_file: 'error',
          page_data: { error: { status: 403, message: 'This profile is visible to friends only.' } },
          user: req.user
        });
      }
      const a = String(req.user._id);
      const b = String(owner._id);
      const aDoc = await UserFriends.findOne({ user_id: a, 'friends.user_id': b });
      const bDoc = await UserFriends.findOne({ user_id: b, 'friends.user_id': a });
      if (aDoc && bDoc) return next();
      return res.status(403).render('public assets/template.ejs', {
        page_title: 'Friends Only',
        page_file: 'error',
        page_data: { error: { status: 403, message: 'This profile is visible to friends only.' } },
        user: req.user
      });
    }
    next();
  } catch (e) {
    next();
  }
}

