const MovieDb = require('moviedb-promise');
const User = require('../../../../db/models/user');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

module.exports = function (server) {
  server.get('/api/v1/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit || '5', 10) || 5, 10);

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

      const movies = (movieRes.results || []).slice(0, limit).map(m => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
      }));

      const shows = (tvRes.results || []).slice(0, limit).map(s => ({
        id: s.id,
        name: s.name,
        first_air_date: s.first_air_date,
        poster_path: s.poster_path,
      }));

      const persons = (personRes.results || []).slice(0, limit).map(p => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path
      }));

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
