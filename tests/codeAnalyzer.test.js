import { jest } from '@jest/globals';

// Mock dependencies before any imports
jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn((command, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    cb(null, { stdout: '', stderr: '' }); // Simulate a clean pass
  }),
}));

jest.unstable_mockModule('../model.js', () => ({
  getResponse: jest.fn().mockResolvedValue({
    usage: { input_tokens: 100, output_tokens: 200 },
    content: [{ text: 'Mocked AI analysis' }],
  }),
}));

jest.unstable_mockModule('../fileManager.js', () => ({
  default: {
    read: jest.fn().mockResolvedValue('file content'),
    write: jest.fn().mockResolvedValue(),
  },
}));

jest.unstable_mockModule('../codeGenerator.js', () => ({
    default: {
        calculateTokenStats: jest.fn().mockResolvedValue(),
    }
}));

jest.unstable_mockModule('../logger.js', () => ({
  default: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('../server/memoryManager.js', () => ({
  default: {
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    saveMemory: jest.fn().mockResolvedValue(),
    searchMemories: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule('../config.js', () => ({
    CONFIG: {
        languageConfigs: {
          javascript: { fileExtensions: ['.js'], linter: 'eslint', packageManager: 'npm' },
          python: { fileExtensions: ['.py'], linter: 'pylint', packageManager: 'pip' },
        },
    }
}));

// Import the modules after mocking
const CodeAnalyzer = (await import('../codeAnalyzer.js')).default;
const { getResponse } = await import('../model.js');
const { exec } = await import('child_process');
const FileManager = (await import('../fileManager.js')).default;
const MemoryManager = (await import('../server/memoryManager.js')).default;
const logger = (await import('../logger.js')).default;

describe('CodeAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runLintChecks', () => {
    it('should run lint checks successfully for a supported language', async () => {
      await CodeAnalyzer.runLintChecks('test.js');
      expect(exec).toHaveBeenCalledWith('npx eslint test.js', expect.any(Object), expect.any(Function));
      expect(logger.log).toHaveBeenCalledWith('✅ eslint passed for test.js');
    });

    it('should handle lint checks with errors', async () => {
      exec.mockImplementation((cmd, opts, cb) => cb({ message: 'Lint Error' }, { stdout: '', stderr: 'Error: Missing semicolon.' }));
      await CodeAnalyzer.runLintChecks('test.js');
      expect(logger.log).toHaveBeenCalledWith('❌ Error running eslint: Lint Error');
    });

    it('should log a warning for unsupported file types', async () => {
        await CodeAnalyzer.runLintChecks('test.txt');
        expect(logger.log).toHaveBeenCalledWith('⚠️ No linter configured for file extension: .txt');
        expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('analyzeCodeQuality', () => {
    it('should construct a prompt with memories if they exist', async () => {
        MemoryManager.searchMemories.mockResolvedValueOnce([{
            file: 'old.js',
            learnings: 'Use const instead of let',
            code: 'let x = 1;',
            tags: ['javascript']
        }]);

        await CodeAnalyzer.analyzeCodeQuality('test.js');

        expect(MemoryManager.connect).toHaveBeenCalled();
        expect(MemoryManager.searchMemories).toHaveBeenCalled();
        expect(getResponse).toHaveBeenCalled();
        const prompt = getResponse.mock.calls[0][0];

        expect(prompt).toContain('Here are some related memories');
        expect(prompt).toContain('Learnings: Use const instead of let');
        expect(MemoryManager.disconnect).toHaveBeenCalled();
    });

    it('should handle file read errors by proceeding with null content', async () => {
        FileManager.read.mockResolvedValueOnce(null);
        const result = await CodeAnalyzer.analyzeCodeQuality('nonexistent.js');

        expect(getResponse).toHaveBeenCalled();
        const prompt = getResponse.mock.calls[0][0];
        expect(prompt).toContain('Analyze the following javascript code for quality and provide improvement suggestions:\nnull');

        expect(result.analysis).toBe('Mocked AI analysis');
        expect(result.fileContent).toBeNull();
    });
  });

  describe('recordMemory', () => {
    it('should call MemoryManager.saveMemory with the correct data', async () => {
        await CodeAnalyzer.recordMemory('myFile.js', 'A great learning', 'refactor, performance');
        expect(MemoryManager.connect).toHaveBeenCalled();
        expect(MemoryManager.saveMemory).toHaveBeenCalledWith({
            project: expect.any(String),
            file: 'myFile.js',
            code: 'file content',
            learnings: 'A great learning',
            tags: ['javascript', 'refactor', 'performance'],
        });
        expect(MemoryManager.disconnect).toHaveBeenCalled();
    });
  });

  describe('extractJavaScriptDependencies', () => {
      it('should extract various forms of imports', () => {
          const content = `
            import defaultExport from 'module-a';
            import * as name from 'module-b';
            import { export1 } from 'module-c';
            import { export1 as alias1 } from 'module-d';
            const lazy = lazy(() => import('module-e'));
          `;
          const deps = CodeAnalyzer.extractJavaScriptDependencies(content);
          expect(deps).toEqual(expect.arrayContaining(['module-a', 'module-b', 'module-c', 'module-d', 'module-e']));
      });
  });
});