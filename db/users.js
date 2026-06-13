const { mongoose } = require('./index');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // optional: conturile create prin Google nu au parola locala
    passwordHash: { type: String },
    // id-ul returnat de Google pentru acest user; sparse => permite null fara
    // sa strice unicitatea (userii clasici nu au googleId)
    googleId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
