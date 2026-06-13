const express = require('express');
const mongoose = require('mongoose');
const GraphFile = require('../db/files');
const requireLogin = require('../middleware/requireLogin');

const router = express.Router();

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

router.get('/dashboard', requireLogin, async (req, res, next) => {
    try {
        const files = await GraphFile.find({ ownerId: req.session.userId })
            .sort({ updatedAt: -1 });
        res.render('dashboard', { files });
    } catch (err) {
        next(err);
    }
});

router.post('/files', requireLogin, async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim() || 'Fisier fara titlu';
        const file = await GraphFile.create({ ownerId: req.session.userId, name });
        res.redirect(`/canvas/${file._id}`);
    } catch (err) {
        next(err);
    }
});

router.post('/files/:id/delete', requireLogin, async (req, res, next) => {
    try {
        if (!isValidId(req.params.id)) return res.redirect('/dashboard');
        await GraphFile.deleteOne({ _id: req.params.id, ownerId: req.session.userId });
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

router.get('/canvas/:id', requireLogin, async (req, res, next) => {
    try {
        if (!isValidId(req.params.id)) return res.redirect('/dashboard');
        const file = await GraphFile.findOne({ _id: req.params.id, ownerId: req.session.userId });
        if (!file) return res.redirect('/dashboard');
        res.render('canvas', { file });
    } catch (err) {
        next(err);
    }
});

router.get('/api/files/:id', requireLogin, async (req, res, next) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'not found' });
        const file = await GraphFile.findOne({ _id: req.params.id, ownerId: req.session.userId });
        if (!file) return res.status(404).json({ error: 'not found' });
        res.json({
            _id: file._id,
            name: file.name,
            nodes: file.nodes,
            edges: file.edges
        });
    } catch (err) {
        next(err);
    }
});

router.put('/api/files/:id', requireLogin, async (req, res, next) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'not found' });
        const { name, nodes, edges } = req.body;
        const update = {};
        if (typeof name === 'string') update.name = name.trim() || 'Untitled file';
        if (Array.isArray(nodes)) {
            update.nodes = nodes.map(n => ({
                nodeId: String(n.nodeId),
                label: String(n.label || 'New node'),
                note: String(n.note || ''),
                x: Number(n.x) || 0,
                y: Number(n.y) || 0,
                w: Number(n.w) || 80,
                h: Number(n.h) || 80,
                fontSize: Number(n.fontSize) || 13
            }));
        }
        if (Array.isArray(edges)) {
            update.edges = edges.map(e => ({
                edgeId: String(e.edgeId),
                source: String(e.source),
                target: String(e.target)
            }));
        }
        const file = await GraphFile.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.session.userId },
            { $set: update },
            { new: true }
        );
        if (!file) return res.status(404).json({ error: 'not found' });
        res.json({ ok: true, updatedAt: file.updatedAt });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
