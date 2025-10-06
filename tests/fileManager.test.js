import { jest } from '@jest/globals';

// Mock the 'fs/promises' module before any imports
const mockFiles = {
  'test.txt': 'hello world',
  '.gitignore': 'node_modules\ndist',
  'src/index.js': 'console.log("main")',
  'src/components/button.js': 'export default () => "button"',
  'README.md': '# Project',
};

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: jest.fn(async (path) => {
      if (mockFiles[path]) {
        return mockFiles[path];
      }
      throw new Error(`File not found: ${path}`);
    }),
    writeFile: jest.fn(async (path, content) => {
      mockFiles[path] = content;
    }),
    mkdir: jest.fn().mockResolvedValue(),
    readdir: jest.fn(async (dirPath) => {
        if (dirPath === process.cwd()) {
            return [
                { name: 'test.txt', isFile: () => true, path: process.cwd() },
                { name: '.gitignore', isFile: () => true, path: process.cwd() },
                { name: 'src', isFile: () => false, isDirectory: () => true, path: process.cwd() },
                { name: 'node_modules', isFile: () => false, isDirectory: () => true, path: process.cwd() },
                { name: 'README.md', isFile: () => true, path: process.cwd() },
            ];
        }
        if (dirPath.endsWith('src')) {
             return [
                { name: 'index.js', isFile: () => true, path: 'src' },
                { name: 'components', isFile: () => false, isDirectory: () => true, path: 'src' },
             ];
        }
        if (dirPath.endsWith('components')) {
            return [{ name: 'button.js', isFile: () => true, path: 'src/components' }];
        }
        return [];
    }),
    unlink: jest.fn().mockResolvedValue(),
    rename: jest.fn().mockResolvedValue(),
    copyFile: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ size: 123, birthtime: new Date(), mtime: new Date(), atime: new Date() }),
  },
}));

// Mock the config module
jest.unstable_mockModule('../config.js', () => ({
    CONFIG: {
        excludedFiles: ['config.js'],
        excludedDirs: ['node_modules', 'dist', '.git'],
        excludedExtensions: ['.log', '.tmp'],
        languageConfigs: {
            javascript: { fileExtensions: ['.js', '.jsx'] },
            python: { fileExtensions: ['.py'] },
        },
    }
}));


// Now, import the module to be tested
const FileManager = (await import('../fileManager.js')).default;
const fs = (await import('fs/promises')).default;


describe('FileManager', () => {
    beforeEach(() => {
        // Clear all mock function calls before each test
        jest.clearAllMocks();
        // Restore console.error and console.log to avoid polluting test output
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('read', () => {
        it('should read a file successfully', async () => {
            const content = await FileManager.read('test.txt');
            expect(content).toBe('hello world');
            expect(fs.readFile).toHaveBeenCalledWith('test.txt', 'utf8');
        });

        it('should return null if the file does not exist', async () => {
            const content = await FileManager.read('nonexistent.txt');
            expect(content).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });

        it('should return null for a missing .gitignore without logging an error', async () => {
            const content = await FileManager.read('.gitignore-missing');
            expect(content).toBeNull();
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('write', () => {
        it('should write a file successfully', async () => {
            await FileManager.write('new-file.txt', 'new content');
            expect(fs.writeFile).toHaveBeenCalledWith('new-file.txt', 'new content', 'utf8');
            expect(mockFiles['new-file.txt']).toBe('new content');
        });

        it('should create subfolders before writing', async () => {
            await FileManager.write('new/dir/file.txt', 'content');
            expect(fs.mkdir).toHaveBeenCalledWith('new/dir', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalled();
        });
    });

    describe('getFilesToProcess', () => {
        it('should return a list of processable files, respecting .gitignore and config exclusions', async () => {
            // This is a simplified mock for readdir to test filtering logic
            fs.readdir.mockResolvedValueOnce([
                { name: 'index.js', isFile: () => true, path: process.cwd() },
                { name: 'README.md', isFile: () => true, path: process.cwd() },
                { name: 'node_modules', isFile: () => false, isDirectory: () => true, path: process.cwd() },
                { name: 'dist', isFile: () => false, isDirectory: () => true, path: process.cwd() },
                { name: 'config.js', isFile: () => true, path: process.cwd() },
                { name: 'test.log', isFile: () => true, path: process.cwd() },
            ]);

            const files = await FileManager.getFilesToProcess();

            expect(files).not.toContain('node_modules/somefile.js');
            expect(files).not.toContain('dist/bundle.js');
            expect(files).not.toContain('config.js');
            expect(files).not.toContain('test.log');
            expect(files).toContain('index.js');
            expect(files).toContain('README.md');
        });
    });

    describe('getProjectStructure', () => {
        it('should convert a flat file list into a nested structure', async () => {
            // Mock getFilesToProcess to return a controlled list
            jest.spyOn(FileManager, 'getFilesToProcess').mockResolvedValue([
                'index.js',
                'src/app.js',
                'src/components/button.js'
            ]);

            const structure = await FileManager.getProjectStructure();

            expect(structure).toEqual({
                'index.js': null,
                'src': {
                    'app.js': null,
                    'components': {
                        'button.js': null,
                    },
                },
            });
        });
    });

    describe('getLanguageConfig', () => {
        it('should return the correct language config for a given file path', () => {
            const config = FileManager.getLanguageConfig('my/file.js');
            expect(config.language).toBe('javascript');
        });

        it('should return null for an unknown file extension', () => {
            const config = FileManager.getLanguageConfig('document.pdf');
            expect(config).toBeNull();
        });
    });

    describe('deleteFile', () => {
        it('should call fs.unlink with the correct path', async () => {
            await FileManager.deleteFile('file-to-delete.txt');
            expect(fs.unlink).toHaveBeenCalledWith('file-to-delete.txt');
        });
    });
});