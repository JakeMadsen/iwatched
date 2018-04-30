const db = require('mysql2')

module.exports = {
    "connect_local": () => {
        return db.createConnection({
            multipleStatements: true,
            host : 'localhost',
            user : 'root',
            password : '',
            database : 'db_iwatched'
        })
    },
    "connect" : () => {
        return db.createConnection({
            multipleStatements: true,
            host : '',
            user : '',
            password : '',
            database : ''
        })
    }
}
