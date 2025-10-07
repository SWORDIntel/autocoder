import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import logger from './logger.js';

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

            if (!fileContent || fileContent.trim() === '') {
                this.settings = this.getDefaults();
                await this.save();
            } else {
                const loadedSettings = JSON.parse(fileContent);
                this.settings = {
                    ...this.getDefaults(),
                    ...loadedSettings,
                };
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.settings = this.getDefaults();
                await this.save();
            } else {
                logger.error('Error loading settings, using defaults:', error);
                this.settings = this.getDefaults();
            }
        }
        return this.settings;
    }

    async save() {
        try {
            await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(this.settings, null, 2), 'utf8');
        } catch (error) {
            logger.error('Error saving settings:', error);
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

const settingsManager = new SettingsManager();
settingsManager.load().catch(err => {
    logger.error("Initial settings load failed on module import:", err);
});

export default settingsManager;