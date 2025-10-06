import { jest } from '@jest/globals';
import path from 'path';
import os from 'os';

const SETTINGS_FILE_PATH = path.join(os.homedir(), '.autocode.settings.json');

// Mock fs/promises before any modules are imported
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
};
jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
}));

// Now import the module to be tested
const settingsManager = (await import('../settingsManager.js')).default;

describe('SettingsManager', () => {
  beforeEach(() => {
    // Reset mocks and clear any instance state before each test
    jest.clearAllMocks();
    // This is a bit of a hack to reset the singleton's state for testing
    settingsManager.settings = {
        model: 'claude-3.5-sonnet-20240620',
        temperature: 0.7,
        apiKeys: {
            anthropic: '',
            openai: '',
            google: '',
            deepseek: '',
        }
    };
  });

  describe('load', () => {
    it('should load settings from an existing file', async () => {
      const mockSettings = {
        model: 'o4-mini',
        temperature: 0.5,
        apiKeys: { openai: 'test-key' },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSettings));

      await settingsManager.load();

      expect(mockFs.readFile).toHaveBeenCalledWith(SETTINGS_FILE_PATH, 'utf8');
      expect(settingsManager.get('model')).toBe('o4-mini');
      expect(settingsManager.get('temperature')).toBe(0.5);
      expect(settingsManager.getApiKey('o4-mini')).toBe('test-key');
    });

    it('should create a new settings file with defaults if one does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);
      mockFs.writeFile.mockResolvedValue();

      await settingsManager.load();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        SETTINGS_FILE_PATH,
        JSON.stringify(settingsManager.settings, null, 2),
        'utf8'
      );
    });

    it('should handle errors when loading a malformed settings file', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockFs.readFile.mockRejectedValue(new Error('Unexpected token'));

        await settingsManager.load();

        // Should not throw, should log an error, and should retain default settings
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(settingsManager.get('model')).toBe('claude-3.5-sonnet-20240620');
        consoleErrorSpy.mockRestore();
    });
  });

  describe('set', () => {
    it('should set a new value and save the settings file', async () => {
      await settingsManager.set('model', 'gemini-1.5-pro-latest');

      expect(settingsManager.get('model')).toBe('gemini-1.5-pro-latest');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        SETTINGS_FILE_PATH,
        expect.stringContaining('"model": "gemini-1.5-pro-latest"'),
        'utf8'
      );
    });
  });

  describe('getApiKey', () => {
    it('should return the correct API key for each model type', async () => {
      const mockApiKeys = {
        anthropic: 'claude-key',
        openai: 'openai-key',
        google: 'gemini-key',
        deepseek: 'deepseek-key',
      };
      settingsManager.settings.apiKeys = mockApiKeys;

      expect(settingsManager.getApiKey('claude-3.5-sonnet-20240620')).toBe('claude-key');
      expect(settingsManager.getApiKey('o4-mini')).toBe('openai-key');
      expect(settingsManager.getApiKey('gemini-1.5-pro-latest')).toBe('gemini-key');
      expect(settingsManager.getApiKey('deepseek-coder')).toBe('deepseek-key');
      expect(settingsManager.getApiKey('unknown-model')).toBeNull();
    });
  });
});