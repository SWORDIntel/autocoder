import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const SETTINGS_FILE_PATH = path.join(os.homedir(), '.autocode.settings.json');

class SettingsManager {
    constructor() {
        this.settings = this.getDefaults();
    }

    getDefaults() {
        return {
            model: null, // Path to the selected local model
            temperature: 0.7,
        };
    }

    async load() {
        try {
            const fileContent = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');

            // Guard against empty or whitespace-only files
            if (!fileContent || fileContent.trim() === '') {
                this.settings = this.getDefaults();
                await this.save();
            } else {
                const loadedSettings = JSON.parse(fileContent);
                // Merge loaded settings with defaults
                this.settings = {
                    ...this.getDefaults(),
                    ...loadedSettings,
                };
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, save the default settings.
                this.settings = this.getDefaults();
                await this.save();
            } else {
                // For other errors (like JSON syntax errors), log it and use defaults.
                console.error('Error loading settings, using defaults:', error);
                this.settings = this.getDefaults();
            }
        }
        return this.settings;
    }

    async save() {
        try {
            await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(this.settings, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    get(key) {
        return this.settings[key];
    }

    async set(key, value) {
        this.settings[key] = value;
        await this.save();
    }
}

// Export a singleton instance
const settingsManager = new SettingsManager();
// The initial load is best-effort. The app entry point will also call load.
settingsManager.load().catch(err => {
    // This catch is to prevent unhandled promise rejections during module load.
    console.error("Initial settings load failed on module import:", err);
});

export default settingsManager;