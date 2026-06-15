require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('path');

const { connect } = require('./db');
const passport = require('./config/passport');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// In production SESSION_SECRET is a must, but for locally it works on a fallback of dev
const SESSION_SECRET = process.env.SESSION_SECRET || (isProduction ? null : 'dev-secret');
if (!SESSION_SECRET) {
    console.error('SESSION_SECRET lipseste. Seteaza-l ca variabila de mediu in productie.');
    process.exit(1);
}

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    name: 'nn.sid', // cookie name
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 60 * 60 * 24 * 7 // session expires in 7 days
    }),
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.currentUser = req.session.email || null;
    next();
});

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('home');
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/files'));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Eroare interna: ' + err.message);
});

const PORT = process.env.PORT || 3000;

connect()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Serverul ruleaza pe http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Conexiunea la MongoDB a esuat:', err.message);
        process.exit(1);
    });
