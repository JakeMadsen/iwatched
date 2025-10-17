const axios = require('axios');
const url = "https://api.themoviedb.org/3";
const key = process.env.TMDB_API_KEY || "ab4e974d12c288535f869686bd72e1da";


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
            axios.get(`${url}/discover/tv?api_key=${key}&language=en-US&sort_by=popularity.desc&page=1&include_null_first_air_dates=false`)
            .then(response => {
                resolve(response.data.results)
            })
            .catch(error => {
                reject(error)
            })
        })
    },
    
}
