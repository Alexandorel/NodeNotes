const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../db/users');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login', { title: 'Autentificare - NodeNotes', error: null });
});

router.post('/login', async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Email si parola sunt obligatorii'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Email sau parola incorecte'
            });
        }

        const corect = await bcrypt.compare(password, user.passwordHash);
        if (!corect) {
            return res.status(401).render('login', {
                title: 'Autentificare - NodeNotes',
                error: 'Email sau parola incorecte'
            });
        }

        req.session.userId = user._id.toString();
        req.session.email = user.email;
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
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Email si parola sunt obligatorii'
            });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Adresa de email nu este valida'
            });
        }
        if (password.length < 6) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Parola trebuie sa aiba cel putin 6 caractere'
            });
        }
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).render('register', {
                title: 'Inregistrare - NodeNotes',
                error: 'Email deja folosit'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ email, passwordHash });

        req.session.userId = user._id.toString();
        req.session.email = user.email;
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
