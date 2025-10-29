const getUser = require('../../middleware/getUser');
const enforceProfileVisibility = require('../../middleware/enforceProfileVisibility');
const createError = require('http-errors');

const UserMovie = require('../../../db/models/userMovie');
const UserMovieTotals = require('../../../db/models/userMovieTotals');

function formatTimeWatched(runtimeMinutes) {
  const runtime = Number(runtimeMinutes) || 0;
  const days = Math.floor(runtime / 1440);
  const hours = Math.floor((runtime - (days * 1440)) / 60);
  const minutes = Math.round(runtime % 60);
  const dayText = (days === 1) ? 'day' : 'days';
  const hourText = (hours === 1) ? 'hour' : 'hours';
  return `${days} ${dayText} and ${hours} ${hourText} and ${minutes} minutes`;
}

module.exports = (server) => {
  console.log('* Temp Profile (new schema) Routes Loaded');

  async function buildHeaderData(userId) {
    // Show unique movies watched (matches legacy header when old data had unique-only entries)
    let moviesCount = 0;
    let moviesTime = '-';
    try {
      moviesCount = await UserMovie.countDocuments({ user_id: userId, movie_watched_count: { $gt: 0 } });
    } catch (_) { moviesCount = 0; }
    try {
      const totals = await UserMovieTotals.findOne({ user_id: userId }).lean();
      if (totals) moviesTime = formatTimeWatched(Number(totals.total_runtime) || 0);
    } catch (_) {}
    return { moviesCount, moviesTime };
  }

  // Activity (main)
  server.get('/temp/:id', getUser, enforceProfileVisibility, async (req, res, next) => {
    if (res.locals.user == null) return next('route');
    const u = res.locals.user;
    const header = await buildHeaderData(u._id);
    res.render('public assets/template.ejs', {
      page_title: 'iWatched - Temp Profile',
      page_file: 'profile_temp',
      page_subFile: 'main',
      page_data: {
        user: u,
        movie_watch_time: header.moviesTime,
        numberOfMoviesWatched: header.moviesCount
      },
      user: req.user
    });
  });

  // Watched movies (new dataset)
  server.get('/temp/:id/watched/movies', getUser, enforceProfileVisibility, async (req, res, next) => {
    if (res.locals.user == null) return next('route');
    const u = res.locals.user;
    const header = await buildHeaderData(u._id);
    res.render('public assets/template.ejs', {
      page_title: 'iWatched - Temp Watched Movies',
      page_file: 'profile_temp',
      page_subFile: 'watched',
      page_data: {
        user: u,
        type: 'movies',
        amountOfMovies: header.moviesCount,
        movie_watch_time: header.moviesTime
      },
      user: req.user
    });
  });

  // Favourited
  server.get('/temp/:id/favourite/movies', getUser, enforceProfileVisibility, async (req, res, next) => {
    if (res.locals.user == null) return next('route');
    const u = res.locals.user;
    res.render('public assets/template.ejs', {
      page_title: 'iWatched - Temp Favourites',
      page_file: 'profile_temp',
      page_subFile: 'favourited',
      page_data: { user: u },
      user: req.user
    });
  });

  // Saved
  server.get('/temp/:id/saved/movies', getUser, enforceProfileVisibility, async (req, res, next) => {
    if (res.locals.user == null) return next('route');
    const u = res.locals.user;
    res.render('public assets/template.ejs', {
      page_title: 'iWatched - Temp Saved',
      page_file: 'profile_temp',
      page_subFile: 'saved',
      page_data: { user: u },
      user: req.user
    });
  });
}
