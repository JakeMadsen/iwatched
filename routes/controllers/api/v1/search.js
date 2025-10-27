const MovieDb = require('moviedb-promise');
const User = require('../../../../db/models/user');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

module.exports = function (server) {
  server.get('/api/v1/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    // Allow larger people sets so "empty" person profiles still surface
    const limit = Math.min(parseInt(req.query.limit || '10', 10) || 10, 20);

    if (!q) {
      return res.status(200).send({ q: '', movies: [], shows: [], users: [] });
    }

    try {
      const [movieRes, tvRes, personRes, users] = await Promise.all([
        tmdService.searchMovie({ query: q, page: 1, include_adult: false }).catch(() => ({ results: [] })),
        tmdService.searchTv({ query: q, page: 1 }).catch(() => ({ results: [] })),
        tmdService.searchPerson({ query: q, page: 1 }).catch(() => ({ results: [] })),
        // Basic user search by username or custom URL
        User.find({
          $or: [
            { 'local.username': { $regex: q, $options: 'i' } },
            { 'profile.custom_url': { $regex: q, $options: 'i' } },
          ],
        })
          .limit(limit)
          .lean()
      ]);

      const movies = (movieRes.results || [])
        .filter(m => (m && m.release_date) && Number(m.vote_count||0) > 0)
        .slice(0, limit).map(m => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
      }));

      const shows = (tvRes.results || [])
        .filter(s => {
          const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
          const notReality = !ids.includes(10764);
          const hasDate = !!(s && s.first_air_date);
          const hasVotes = Number(s && s.vote_count || 0) > 0;
          return notReality && hasDate && hasVotes;
        })
        .slice(0, limit).map(s => ({
        id: s.id,
        name: s.name,
        first_air_date: s.first_air_date,
        poster_path: s.poster_path,
      }));

      function okMovie(it){
        const ids = Array.isArray(it && it.genre_ids) ? it.genre_ids : [];
        const notDoc = !ids.includes(99);
        const hasDate = !!(it && it.release_date);
        const hasVotes = (it && Number(it.vote_count)) > 0;
        return notDoc && hasDate && hasVotes;
      }
      function okShow(it){
        const ids = Array.isArray(it && it.genre_ids) ? it.genre_ids : [];
        const notReality = !ids.includes(10764);
        const notTalk = !ids.includes(10767);
        const notNews = !ids.includes(10763);
        const notDoc = !ids.includes(99);
        const hasDate = !!(it && it.first_air_date);
        const hasVotes = (it && Number(it.vote_count)) > 0;
        return notReality && notTalk && notNews && notDoc && hasDate && hasVotes;
      }
      const persons = (personRes.results || [])
        .filter(p => {
          const known = Array.isArray(p && p.known_for) ? p.known_for : [];
          if (!known.length) return false; // empty person profile -> skip
          // keep if any known_for passes our content filters
          return known.some(it => (it && it.media_type === 'movie' && okMovie(it)) || (it && it.media_type === 'tv' && okShow(it)));
        })
        .slice(0, limit)
        .map(p => ({ id: p.id, name: p.name, profile_path: p.profile_path }));

      const userItems = (users || []).map(u => ({
        id: u._id,
        username: (u.local && u.local.username) || '',
        slug: (u.profile && u.profile.custom_url) || null,
        avatar: (u.profile && u.profile.profile_image)
          ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
          : null,
      }));

      res.send({ q, movies, shows, persons, users: userItems });
    } catch (e) {
      res.status(500).send({ q, movies: [], shows: [], users: [], error: 'search_failed' });
    }
  });
}
