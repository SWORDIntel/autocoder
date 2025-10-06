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

describe('SettingsManager (Local-Only)', () => {
  beforeEach(() => {
    // Reset mocks and clear any instance state before each test
    jest.clearAllMocks();
    // Reset the singleton's state for testing
    settingsManager.settings = {
        model: null,
        temperature: 0.7,
    };
     // Mock console to keep test output clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
      jest.restoreAllMocks();
  });

  describe('load', () => {
    it('should load settings from an existing file', async () => {
      const mockSettings = {
        model: '/path/to/local/model',
        temperature: 0.5,
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSettings));

      await settingsManager.load();

      expect(mockFs.readFile).toHaveBeenCalledWith(SETTINGS_FILE_PATH, 'utf8');
      expect(settingsManager.get('model')).toBe('/path/to/local/model');
      expect(settingsManager.get('temperature')).toBe(0.5);
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
        mockFs.readFile.mockRejectedValue(new Error('Unexpected token'));
        await settingsManager.load();
        // Should not throw, should log an error, and should retain default settings
        expect(console.error).toHaveBeenCalled();
        expect(settingsManager.get('model')).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a new value and save the settings file', async () => {
      await settingsManager.set('model', '/new/path/model');
      expect(settingsManager.get('model')).toBe('/new/path/model');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        SETTINGS_FILE_PATH,
        expect.stringContaining('"model": "/new/path/model"'),
        'utf8'
      );
    });
  });

  describe('get', () => {
      it('should get a value from the settings', async () => {
          settingsManager.settings.temperature = 0.9;
          const temp = settingsManager.get('temperature');
          expect(temp).toBe(0.9);
      });
  });
});