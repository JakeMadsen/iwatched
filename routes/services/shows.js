const axios = require('axios');
const url = "https://api.themoviedb.org/3";
const envKey = process.env.TMDB_API_KEY;
const key = (envKey && !/^your-tmdb-api-key$/i.test(envKey)) ? envKey : "ab4e974d12c288535f869686bd72e1da";


module.exports = {
    getOneShow: (id) => {
        return new Promise((resolve, reject) => {
            axios.get(`${url}/tv/${id}?api_key=${key}&language=en-US`)
            .then(response => {
                resolve(response.data)
            })
            .catch(error => {
                reject(error)
            })
        })
    },
    getPopularShows: () => {
        return new Promise((resolve, reject) => {
            // Exclude reality genre 10764
            axios.get(`${url}/discover/tv?api_key=${key}&language=en-US&sort_by=popularity.desc&page=1&include_null_first_air_dates=false&without_genres=10764`)
            .then(response => {
                try {
                    const list = Array.isArray(response.data && response.data.results) ? response.data.results : [];
                    const filtered = list.filter(r => {
                        const ids = Array.isArray(r && r.genre_ids) ? r.genre_ids : [];
                        const notReality = !ids.includes(10764);
                        const hasDate = !!(r && r.first_air_date);
                        const hasVotes = (r && Number(r.vote_count)) > 0;
                        return notReality && hasDate && hasVotes;
                    });
                    resolve(filtered);
                } catch(_) {
                    resolve(response.data.results)
                }
            })
            .catch(error => {
                reject(error)
            })
        })
    },
    
}
