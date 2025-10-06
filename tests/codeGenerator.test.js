import { jest } from '@jest/globals';
import { getResponse } from '../model.js'; // Import from the global mock

// --- Mocks Setup ---

// Mock FileManager (still needed as it's not globally mocked)
const mockFileManager = {
  read: jest.fn(),
  write: jest.fn(),
};
jest.unstable_mockModule('../fileManager.js', () => ({
  __esModule: true,
  default: mockFileManager,
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

// Mock console
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  cyan: jest.fn(),
};

// --- Dynamic Import ---

// Dynamically import the module under test AFTER mocks are defined
const { default: CodeGenerator } = await import('../codeGenerator.js');

// --- Test Suite ---

describe('CodeGenerator', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('cleanGeneratedCode', () => {
    it('should remove markdown code blocks from the start and end of the code', () => {
      const code = '```javascript\nconst a = 1;\n```';
      const expected = 'const a = 1;';
      expect(CodeGenerator.cleanGeneratedCode(code)).toBe(expected);
    });

    it('should return the original string if no code block is found', () => {
      const code = 'const a = 1;';
      expect(CodeGenerator.cleanGeneratedCode(code)).toBe(code);
    });

    it('should handle different language identifiers', () => {
        const code = '```python\nprint("hello")\n```';
        const expected = 'print("hello")';
        expect(CodeGenerator.cleanGeneratedCode(code)).toBe(expected);
      });
  });

  describe('generate', () => {
    it('should construct the correct prompt and return cleaned code', async () => {
      const readme = 'This is the readme.';
      const currentCode = 'let x = 1;';
      const fileName = 'test.js';
      const projectStructure = { 'test.js': null };
      const allFileContents = { 'test.js': currentCode };
      const model = 'test-model';
      const apiKey = 'test-key';

      const mockApiResponse = {
        content: [{ text: '```javascript\nlet x = 2;\n```' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      // Use the imported mock function
      getResponse.mockResolvedValue(mockApiResponse);

      const result = await CodeGenerator.generate(readme, currentCode, fileName, projectStructure, allFileContents, model, apiKey);

      // Verify prompt construction
      expect(getResponse).toHaveBeenCalledTimes(1);
      const prompt = getResponse.mock.calls[0][0];
      expect(prompt).toContain(readme);
      expect(prompt).toContain(currentCode);
      expect(prompt).toContain(fileName);
      expect(prompt).toContain('Language: javascript');

      // Verify result
      expect(result).toBe('let x = 2;');

      // Verify spinner was used
      expect(mockOraInstance.start).toHaveBeenCalled();
      expect(mockOraInstance.succeed).toHaveBeenCalled();
    });
  });

  describe('updateReadme', () => {
    it('should call the AI model with a prompt to update the README', async () => {
        const readme = 'Initial README';
        const projectStructure = { 'file.js': null };
        const model = 'test-model';
        const apiKey = 'test-key';

        const mockApiResponse = {
            content: [{ text: 'Updated README' }],
            usage: { input_tokens: 100, output_tokens: 50 },
        };
        getResponse.mockResolvedValue(mockApiResponse);

        const result = await CodeGenerator.updateReadme(readme, projectStructure, model, apiKey);

        expect(getResponse).toHaveBeenCalledTimes(1);
        const prompt = getResponse.mock.calls[0][0];
        expect(prompt).toContain('update the README.md file');
        expect(prompt).toContain(readme);
        expect(prompt).toContain(JSON.stringify(projectStructure, null, 2));
        expect(result).toBe('Updated README');
    });
  });

  describe('getLanguageFromExtension', () => {
    it('should return the correct language for a given extension', () => {
        expect(CodeGenerator.getLanguageFromExtension('.js')).toBe('javascript');
        expect(CodeGenerator.getLanguageFromExtension('.py')).toBe('python');
        expect(CodeGenerator.getLanguageFromExtension('.cs')).toBe('csharp');
    });

    it('should return javascript as a default for unknown extensions', () => {
        expect(CodeGenerator.getLanguageFromExtension('.unknown')).toBe('javascript');
    });
  });
});