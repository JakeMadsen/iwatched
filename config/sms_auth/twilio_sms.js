const   accountSid = "ACdee581bac495973b6b3c97e0abb1c092",
        authToken  = "a3269f0ea81177ec81572ea21ea30abb";

var twilio = require('twilio');
var client = new twilio(accountSid, authToken);

let twilioPhoneNumber = "(973) 755-0839 "
let userPhoneNumber = "+4560666015"


client.messages
  .create({
     body: 'Hello there',
     from: twilioPhoneNumber,
     to: userPhoneNumber
   })
  .then(message => console.log(message.sid))
  .done();