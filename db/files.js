const { mongoose } = require('./index');

const nodeSchema = new mongoose.Schema({
    nodeId: { type: String, required: true },
    label: { type: String, default: 'New node' },
    note: { type: String, default: '' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 80 },
    h: { type: Number, default: 80 },
    fontSize: { type: Number, default: 13 }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
    edgeId: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true }
}, { _id: false });

const fileSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'Untitled file' },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('GraphFile', fileSchema);
