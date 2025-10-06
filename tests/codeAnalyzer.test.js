import { jest } from '@jest/globals';
import { promisify } from 'util';
import { getResponse } from '../model.js'; // Import from the global mock

// --- Mocks Setup ---

// Mock child_process
const mockExecAsync = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  exec: (command, options, callback) => {
    const promise = mockExecAsync(command, options);
    if (callback) {
      promise.then(result => callback(null, result.stdout, result.stderr)).catch(err => callback(err));
    }
  },
}));
jest.unstable_mockModule('util', () => ({
    promisify: () => mockExecAsync,
}));

// Mock FileManager
const mockFileManager = {
  read: jest.fn(),
  write: jest.fn(),
  createSubfolders: jest.fn(),
};
jest.unstable_mockModule('../fileManager.js', () => ({
  __esModule: true,
  default: mockFileManager,
}));

// Mock CodeGenerator (we only need calculateTokenStats)
const mockCodeGenerator = {
    calculateTokenStats: jest.fn(),
};
jest.unstable_mockModule('../codeGenerator.js', () => ({
    __esModule: true,
    default: mockCodeGenerator,
}));

// Mock MemoryManager
const mockMemoryManager = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    saveMemory: jest.fn(),
    searchMemories: jest.fn(),
};
jest.unstable_mockModule('../server/memoryManager.js', () => ({
    __esModule: true,
    default: mockMemoryManager,
}));

// Mock ora (spinner)
const mockOraInstance = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
};
jest.unstable_mockModule('ora', () => ({
    __esModule: true,
    default: jest.fn(() => mockOraInstance),
}));


// Mock UI/console
const mockUi = {
    log: jest.fn(),
};
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// --- Dynamic Import ---

// Dynamically import the module under test AFTER mocks are defined
const { default: CodeAnalyzer } = await import('../codeAnalyzer.js');

// --- Test Suite ---

describe('CodeAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCodeQuality', () => {
    it('should build a prompt with memory context if memories are found', async () => {
      const filePath = 'src/test.js';
      const fileContent = 'function hello() {}';
      const mockMemories = [{ file: 'old.js', learnings: 'use const', code: 'var x=1', tags: ['javascript'] }];

      mockFileManager.read.mockResolvedValue(fileContent);
      mockMemoryManager.searchMemories.mockResolvedValue(mockMemories);
      getResponse.mockResolvedValue({ content: [{ text: 'Good code' }], usage: {} });

      await CodeAnalyzer.analyzeCodeQuality(filePath);

      expect(mockMemoryManager.connect).toHaveBeenCalled();
      expect(mockMemoryManager.searchMemories).toHaveBeenCalledWith(fileContent, ['javascript', 'general']);
      expect(getResponse).toHaveBeenCalledTimes(1);
      const prompt = getResponse.mock.calls[0][0];
      expect(prompt).toContain('Here are some related memories');
      expect(prompt).toContain('use const');
      expect(mockMemoryManager.disconnect).toHaveBeenCalled();
    });

    it('should build a prompt without memory context if no memories are found', async () => {
        const filePath = 'src/test.py';
        const fileContent = 'def hello(): pass';

        mockFileManager.read.mockResolvedValue(fileContent);
        mockMemoryManager.searchMemories.mockResolvedValue([]);
        getResponse.mockResolvedValue({ content: [{ text: 'Good code' }], usage: {} });

        await CodeAnalyzer.analyzeCodeQuality(filePath);

        expect(mockMemoryManager.searchMemories).toHaveBeenCalledWith(fileContent, ['python', 'general']);
        expect(getResponse).toHaveBeenCalledTimes(1);
        const prompt = getResponse.mock.calls[0][0];
        expect(prompt).toContain('No specific memories found');
        expect(prompt).not.toContain('Here are some related memories');
      });
  });

  describe('runLintChecks', () => {
    it('should execute the correct linter and report success', async () => {
        const filePath = 'src/app.js';
        mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

        const result = await CodeAnalyzer.runLintChecks(filePath, mockUi);

        expect(mockExecAsync).toHaveBeenCalledWith(`npx eslint ${filePath}`, { encoding: 'utf8' });
        expect(mockUi.log).toHaveBeenCalledWith(expect.stringContaining('✅ eslint passed'));
        expect(result).toBe('');
    });

    it('should report linter warnings from stdout', async () => {
        const filePath = 'src/app.js';
        const warningMessage = 'Warning: unused variable';
        mockExecAsync.mockResolvedValue({ stdout: warningMessage, stderr: '' });

        const result = await CodeAnalyzer.runLintChecks(filePath, mockUi);

        expect(mockUi.log).toHaveBeenCalledWith(expect.stringContaining(`⚠️ eslint warnings:\n${warningMessage}`));
        expect(result).toBe(warningMessage);
    });

    it('should handle linter execution errors', async () => {
        const filePath = 'src/app.js';
        const errorMessage = 'Command failed';
        const error = new Error(errorMessage);
        error.stdout = 'Some output';
        error.stderr = 'Some error output';
        mockExecAsync.mockRejectedValue(error);

        const result = await CodeAnalyzer.runLintChecks(filePath, mockUi);

        expect(mockUi.log).toHaveBeenCalledWith(expect.stringContaining(`❌ Error running eslint: ${errorMessage}`));
        expect(result).toBe(error.stdout);
      });
  });

  describe('recordMemory', () => {
    it('should connect to db, save memory with correct tags, and disconnect', async () => {
        const file = 'test.js';
        const code = 'const a = 1;';
        const learnings = 'This is a good pattern.';
        const tags = 'refactor, performance';

        mockFileManager.read.mockResolvedValue(code);

        const result = await CodeAnalyzer.recordMemory(file, learnings, tags);

        expect(mockMemoryManager.connect).toHaveBeenCalled();
        expect(mockMemoryManager.saveMemory).toHaveBeenCalledWith({
            project: expect.any(String),
            file,
            code,
            learnings,
            tags: ['javascript', 'refactor', 'performance'] // Should combine language and user tags
        });
        expect(mockMemoryManager.disconnect).toHaveBeenCalled();
        expect(result).toContain('Memory successfully recorded');
    });
  });
});