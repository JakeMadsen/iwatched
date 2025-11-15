const axios = require('axios')
const url = "https://api.themoviedb.org/3";
const envKey = process.env.TMDB_API_KEY;
const key = (envKey && !/^your-tmdb-api-key$/i.test(envKey)) ? envKey : "ab4e974d12c288535f869686bd72e1da";


module.exports = {
    getOneMovie: (id) => {
        return new Promise((resolve, reject) => {
            axios.get(`${url}/movie/${id}?api_key=${key}&language=en-US&include_video=true&append_to_response=credits`)
            .then(response => {
                resolve(response.data)
            })
            .catch(error => {
                reject(error)
            })
        })
    },
    getPopularMovies: () => {
        return new Promise((resolve, reject) => {
            axios.get(`${url}/discover/movie?api_key=${key}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=true&page=1`)
            .then(response => {
                try {
                    const list = Array.isArray(response.data && response.data.results) ? response.data.results : [];
                    const filtered = list.filter(r => {
                        const hasDate = !!(r && r.release_date);
                        const hasVotes = (r && Number(r.vote_count)) > 0;
                        return hasDate && hasVotes;
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
    getMoveRuntimeIfNull: (id) => {
        return new Promise((resolve, reject) => {
            axios.get(`${url}/movie/${id}?api_key=${key}&language=en-US&include_video=true`)
            .then(response => {

                resolve(response.data.runtime)
            })
            .catch(error => {
                reject(error)
            })
        })
    }
    
}
