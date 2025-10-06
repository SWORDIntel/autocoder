import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const SETTINGS_FILE_PATH = path.join(os.homedir(), '.autocode.settings.json');

const defaultSettings = {
    model: 'claude-3.5-sonnet-20240620',
    temperature: 0.7,
    apiKeys: {
        anthropic: process.env.CLAUDE_KEY || '',
        openai: process.env.OPENAI_KEY || '',
        google: process.env.GEMINI_KEY || '',
        deepseek: process.env.DEEPSEEK_KEY || '',
    }
};

class SettingsManager {
    constructor() {
        this.settings = { ...defaultSettings };
    }

    async load() {
        try {
            const fileContent = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
            const loadedSettings = JSON.parse(fileContent);
            // Merge loaded settings with defaults to ensure all keys are present
            this.settings = {
                ...defaultSettings,
                ...loadedSettings,
                apiKeys: {
                    ...defaultSettings.apiKeys,
                    ...(loadedSettings.apiKeys || {}),
                }
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, so we'll save the default settings.
                await this.save();
            } else {
                console.error('Error loading settings:', error);
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

    getApiKey(modelName) {
        if (modelName.startsWith('claude')) {
            return this.settings.apiKeys.anthropic;
        }
        if (modelName.startsWith('o3') || modelName.startsWith('o4')) {
            return this.settings.apiKeys.openai;
        }
        if (modelName.startsWith('gemini')) {
            return this.settings.apiKeys.google;
        }
        if (modelName.startsWith('deepseek')) {
            return this.settings.apiKeys.deepseek;
        }
        return null;
    }
}

// Export a singleton instance
const settingsManager = new SettingsManager();
// Load settings on startup, but don't block the module from being imported
settingsManager.load();

export default settingsManager;