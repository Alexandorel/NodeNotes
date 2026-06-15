const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../db/users');

// URL-ul de baza al aplicatiei (in prod: domeniul public; local: localhost)
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Google login strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();

        // user already linked to this Google account
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // an account with the same email exists -> link the Google id to it
        if (email) {
            user = await User.findOne({ email });
            if (user) {
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }
        }

        // 3. brand new user created from the Google profile (no local password)
        user = await User.create({ email, googleId: profile.id });
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

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
