var tmd = require('./oop_tmd'),
    fetch = require('node-fetch');  

module.exports = {
    "getMovies" : (array) => {
        var movies;

        array.forEach(element => {
            fetch()
        });

        fetch(host.fetch_api + '/skoler')
            .then(function (data) {
                return data.json()
            })
            .then(function(school){
                if (school.data_error == true) {
                    console.log("Something went wrong.")
                    res.render('public assets/pages/skoler', {
                        error: true
                    });
                }
                else if (school.data_error == false){
                    console.log("Data found on school:")
                    res.render('public assets/pages/skoler', {
                        all_schools: school.all_schools,
                        school_data: school.school_data
                    });
                }
            })
        }
    }

}