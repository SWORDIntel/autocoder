import { jest } from '@jest/globals';
import path from 'path';
import { CONFIG } from '../config.js';

// Use jest.unstable_mockModule to mock the fs/promises module
// This is the recommended approach for mocking native Node.js modules in ESM
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
};
jest.unstable_mockModule('fs/promises', () => (mockFs));

// Dynamically import the module under test AFTER the mock has been defined
const { default: FileManager } = await import('../fileManager.js');

// Mock the console to prevent logs during tests and to spy on calls
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe('FileManager', () => {
  // Reset mocks before each test to ensure test isolation
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('read', () => {
    it('should read and return file content successfully', async () => {
      const filePath = 'test.txt';
      const content = 'hello world';
      mockFs.readFile.mockResolvedValue(content);

      const result = await FileManager.read(filePath);

      expect(result).toBe(content);
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should return null and log an error if reading fails', async () => {
      const filePath = 'nonexistent.txt';
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await FileManager.read(filePath);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error reading file ${filePath}`));
    });

    it('should return null for .gitignore if it does not exist, without logging an error', async () => {
        const filePath = '.gitignore';
        mockFs.readFile.mockRejectedValue(new Error('File not found'));

        const result = await FileManager.read(filePath);

        expect(result).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
      });
  });

  describe('write', () => {
    it('should write content to a file and create subfolders', async () => {
      const filePath = 'path/to/file.txt';
      const content = 'new content';
      mockFs.mkdir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      await FileManager.write(filePath, content);

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(filePath), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf8');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`File ${filePath} has been updated.`));
    });

    it('should log an error if writing fails', async () => {
      const filePath = 'path/to/fail.txt';
      const content = 'fail content';
      const error = new Error('Disk full');
      mockFs.writeFile.mockRejectedValue(error);

      await FileManager.write(filePath, content);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error writing file ${filePath}`), error);
    });
  });

  describe('getFilesToProcess', () => {
    it('should return a list of files, respecting .gitignore and config exclusions', async () => {
      const gitignoreContent = 'node_modules/\n*.log\ndist';
      mockFs.readFile.mockResolvedValue(gitignoreContent);

      const mockFiles = [
        { path: process.cwd(), name: 'index.js', isFile: () => true },
        { path: process.cwd(), name: 'README.md', isFile: () => true },
        { path: path.join(process.cwd(), 'node_modules'), name: 'some-package', isFile: () => true },
        { path: process.cwd(), name: 'error.log', isFile: () => true },
        { path: path.join(process.cwd(), 'src'), name: 'app.js', isFile: () => true },
        { path: path.join(process.cwd(), 'dist'), name: 'bundle.js', isFile: () => true },
        { path: process.cwd(), name: '.DS_Store', isFile: () => true },
      ];
      mockFs.readdir.mockResolvedValue(mockFiles);

      const originalExcludedFiles = CONFIG.excludedFiles;
      CONFIG.excludedFiles = ['.DS_Store'];

      const files = await FileManager.getFilesToProcess();

      expect(files).not.toContain(path.join('node_modules', 'some-package'));
      expect(files).not.toContain('error.log');
      expect(files).not.toContain(path.join('dist', 'bundle.js'));
      expect(files).not.toContain('.DS_Store');
      expect(files).toContain('index.js');
      expect(files).toContain('README.md');
      expect(files).toContain(path.join('src', 'app.js'));

      CONFIG.excludedFiles = originalExcludedFiles;
    });
  });

  describe('getProjectStructure', () => {
    it('should create a nested object representing the project structure', async () => {
        const mockFiles = [
            'index.js',
            'src/app.js',
            'src/components/button.js',
            'package.json'
        ];
        jest.spyOn(FileManager, 'getFilesToProcess').mockResolvedValue(mockFiles);

        const structure = await FileManager.getProjectStructure();

        expect(structure).toEqual({
            'index.js': null,
            'src': {
                'app.js': null,
                'components': {
                    'button.js': null
                }
            },
            'package.json': null
        });

        FileManager.getFilesToProcess.mockRestore();
    });
  });
});