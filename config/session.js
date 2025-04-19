const session = require('express-session');

module.exports = session({
    secret: "Aka", // Your Secret Key that encrypts session data
    resave: false, //Saves session only when needed
    saveUninitialized: true //Creates session for new users
});