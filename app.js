require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const { connect } = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.username || null;
    next();
});

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.redirect('/login');
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
