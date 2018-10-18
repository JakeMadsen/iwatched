const axios = require('axios')
const url = "https://api.themoviedb.org/3";
const key = "ab4e974d12c288535f869686bd72e1da"


module.exports = {
    getOneMovie: (id) => {
        return new Promise((resolve, reject) => {
            axios.get(`${url}/movie/${id}?api_key=${key}&language=en-US&include_video=true`)
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
                resolve(response.data.results)
            })
            .catch(error => {
                reject(error)
            })
        })
    },
    
}