import mongoose from "mongoose";
import Memory from "./models/memory.js";

const MemoryManager = {
    async connect(dbUrl) {
        if (mongoose.connection.readyState === 0) {
            try {
                await mongoose.connect(dbUrl);
                console.log("✅ Successfully connected to MongoDB.");
            } catch (error) {
                console.error("❌ Error connecting to MongoDB:", error);
                throw error;
            }
        }
    },

    async disconnect() {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log("🔌 Disconnected from MongoDB.");
        }
    },

    async saveMemory({ project, file, code, learnings, tags }) {
        try {
            const newMemory = new Memory({
                project,
                file,
                code,
                learnings,
                tags,
            });
            await newMemory.save();
            console.log(`🧠 Memory saved for: ${project}/${file}`);
            return newMemory;
        } catch (error) {
            console.error("❌ Error saving memory:", error);
            return null;
        }
    },

    async findMemoriesByProject(project) {
        try {
            return await Memory.find({ project }).sort({ createdAt: -1 });
        } catch (error) {
            console.error("❌ Error finding memories by project:", error);
            return [];
        }
    },

    async findMemoryByFile(project, file) {
        try {
            return await Memory.findOne({ project, file });
        } catch (error) {
            console.error("❌ Error finding memory by file:", error);
            return null;
        }
    },

    async searchMemories(query, tags = []) {
        try {
            let searchCriteria = { $text: { $search: query } };
            if (tags.length > 0) {
                searchCriteria.tags = { $in: tags };
            }
            return await Memory.find(
                searchCriteria,
                { score: { $meta: "textScore" } }
            ).sort({ score: { $meta: "textScore" } });
        } catch (error) {
            console.error("❌ Error searching memories:", error);
            return [];
        }
    },

    async updateMemory(id, updates) {
        try {
            return await Memory.findByIdAndUpdate(id, updates, { new: true });
        } catch (error) {
            console.error("❌ Error updating memory:", error);
            return null;
        }
    },

    async deleteMemory(id) {
        try {
            return await Memory.findByIdAndDelete(id);
        } catch (error) {
            console.error("❌ Error deleting memory:", error);
            return null;
        }
    },
};

export default MemoryManager;