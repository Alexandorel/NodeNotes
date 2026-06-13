const mongoose = require('mongoose');

async function connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI lipseste din .env');
    }
    await mongoose.connect(uri);
    console.log('Conectat la MongoDB');
}

module.exports = { connect, mongoose };
