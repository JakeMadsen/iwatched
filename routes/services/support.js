const Support = require('../../db/models/supportMessages');

module.exports = {
    getOneCase: (case_id) => {
        return new Promise ((resolve, reject) => {
            Support.findOne({ '_id' : case_id}, function (error, foundCase) {
                if (error)
                    reject(error, "Could not get open cases")
                else
                    resolve(foundCase)
            });
        })
    },
    getAllCases: () => {
        return new Promise ((resolve, reject) => {
            Support.find    ({'resolved': false }, function (error, open_cases) {
                if (error)
                    reject(error, "Could not get open cases")
                else
                Support.find({ 'resolved': true }, function (error, closed_cases) {
                    if (error)
                        reject(error, "Could not get closed cases")
                    else
                        resolve({'open_cases' : open_cases, 'closed_cases' : closed_cases})
                });
            });
        })
    },
    getAllOpenCases: () => {
        return new Promise ((resolve, reject) => {
            Support.find    ({'resolved': false }, function (error, open_cases) {
                if (error)
                    reject(error, "Could not get open cases")
                else
                    resolve(open_cases)
            });
        })
    },
    getAllClosedCases: () => {
        return new Promise ((resolve, reject) => {
            Support.find({ 'resolved': true }, function (error, closed_cases) {
                if (error)
                    reject(error, "Could not get closed cases")
                else
                    resolve(closed_cases)
            });
        })
    },
    getAllCasesFromUser: (user_id) => {
        return new Promise ((resolve, reject) => {
            Support.find    ({ 'opened_by': user_id, 'resolved': false }, function (error, open_cases) {
                if (error)
                    reject(error, "Could not get open cases")
                else
                Support.find({ 'opened_by': user_id, 'resolved': true }, function (error, closed_cases) {
                    if (error)
                        reject(error, "Could not get closed cases")
                    else
                        resolve({'open_cases' : open_cases, 'closed_cases' : closed_cases})
                });
            });
        })
    },
    openNewCase: (data) => {
        return new Promise ((resolve, reject) => {
            var newCase = new Support()
            newCase.initial(data)
            newCase.save((error, savedCase) => {
                if(error)
                    reject(error)
                else
                    resolve(savedCase)
            })
        })
    },
    closeCase: (case_id) => {
        return new Promise ((resolve, reject) => {
            Support.findOne({ '_id' : case_id}, function (error, foundCase) {
                foundCase.resolve();
                foundCase.save((error, closed) =>{
                    if(error)
                        reject(error);
                    else
                        resolve(closed);
                })
            });
        })

    },
    deleteCase: (case_id) => {
        return new Promise ((resolve, reject) => {
            Support.deleteOne({ '_id' : case_id}, function (error) {
                if(error)
                    reject(error)
                else
                    resolve(true)
            });
        })
    },
    sendNewMessageUser: (case_id, data) => {
        return new Promise ((resolve, reject) => {
            Support.findOne({ '_id' : case_id}, function (error, foundCase) {
                foundCase.newMessage(data, true, false)

                foundCase.save((error, caseSaved) => {
                    if (error)
                        reject(error, "Could not get open cases")
                    else
                        resolve(caseSaved)
                })
            });
        })
    },
    sendNewMessageSupport: (case_id, data) => {
        return new Promise ((resolve, reject) => {
            Support.findOne({ '_id' : case_id}, function (error, foundCase) {
                foundCase.newMessage(data, false, true)
                foundCase.seen_by_support = true;
                foundCase.seen_by_user = false;

                foundCase.save((error, caseSaved) => {
                    if (error)
                        reject(error, "Could not get open cases")
                    else
                        resolve(caseSaved)
                })
            });
        })
    },
    seenByUser: (case_id) => {
        Support.findOne({ '_id' : case_id}, function (error, foundCase) {
            foundCase.seenByUser()
            foundCase.save((error, seen) =>{
                if(error)
                    return error;
                else
                    return true;
            })
        });
    },
    seenBySupport: (case_id) => {
        Support.findOne({ '_id' : case_id}, function (error, foundCase) {
            foundCase.seenBySupport()
            foundCase.save((error, seen) =>{
                if(error)
                    return error;
                else
                    return true;
            })
        });
    }
}