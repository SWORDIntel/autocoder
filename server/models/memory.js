import mongoose from "mongoose";

const memorySchema = new mongoose.Schema({
    project: {
        type: String,
        required: true,
        trim: true,
    },
    file: {
        type: String,
        required: true,
        trim: true,
    },
    code: {
        type: String,
        required: true,
    },
    learnings: {
        type: String,
        required: false,
    },
    tags: {
        type: [String],
        required: false,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

memorySchema.index({ project: 1, file: 1 });
memorySchema.index({ code: 'text', learnings: 'text', tags: 'text' });

const Memory = mongoose.model("Memory", memorySchema);

export default Memory;