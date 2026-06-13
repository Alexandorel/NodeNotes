const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../db/users');

const router = express.Router();

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login', { title: 'Autentificare - NodeNotes', error: null });
});

router.post('/login', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Username si parola sunt obligatorii'
            });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Username sau parola incorecte'
            });
        }

        const corect = await bcrypt.compare(password, user.passwordHash);
        if (!corect) {
            return res.status(401).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Username sau parola incorecte'
            });
        }

        req.session.userId = user._id.toString();
        req.session.username = user.username;
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('register', { title: 'Inregistrare - NodeNotes', error: null });
});

router.post('/register', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Username si parola sunt obligatorii'
            });
        }
        if (password.length < 6) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Parola trebuie sa aiba cel putin 6 caractere'
            });
        }
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Username deja folosit'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ username, passwordHash });

        req.session.userId = user._id.toString();
        req.session.username = user.username;
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
