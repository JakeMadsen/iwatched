const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

module.exports = function (server) {
  console.log('* Show API Routes Loaded Into Server');

  // Search TV series by text
  server.get('/api/v1/shows/search/:search_param?/:page?', async (req, res) => {
    const parameters = {
      query: req.params.search_param || '',
      page: req.params.page || 1,
      include_adult: false
    };

    tmdService
      .searchTv(parameters)
      .then(results => res.send(results))
      .catch(error => res.send(error));
  });

  // Search TV series by genre name
  server.get('/api/v1/shows/search_genre/:genre/:page?', async (req, res) => {
    try {
      const genres = await tmdService.genreTvList();
      let genre_id;
      (genres.genres || []).forEach(g => {
        if (String(req.params.genre).toLowerCase() === String(g.name || '').toLowerCase()) {
          genre_id = g.id;
        }
      });

      if (!genre_id) {
        return res.send({ page: 1, total_pages: 1, total_results: 0, results: [] });
      }

      const parameters = {
        with_genres: genre_id,
        page: req.params.page || 1,
        include_adult: false
      };

      tmdService
        .discoverTv(parameters)
        .then(results => res.send(results))
        .catch(error => res.send(error));
    } catch (e) {
      res.send({ page: 1, total_pages: 1, total_results: 0, results: [] });
    }
  });

  // Get poster path for a TV series
  server.get('/api/v1/shows/get_poster/:id', async (req, res) => {
    try {
      const show = await tmdService.tvInfo(req.params.id);
      if (!show) return res.send('error');
      res.send({ poster_path: show.poster_path });
    } catch (e) {
      res.send('error');
    }
  });
};

