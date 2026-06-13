const passport = require('passport');
const User = require('../db/users');

// when the user is loggin in, the id is saved in session
passport.serializeUser((user, done) => {
    done(null, user._id.toString());
});

// at every loggin, passport takes the user id and places it into body
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
