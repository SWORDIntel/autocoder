import { jest } from '@jest/globals';

// Mock dependencies before any imports
jest.unstable_mockModule('../model.js', () => ({
  getResponse: jest.fn().mockResolvedValue({
    usage: { input_tokens: 100, output_tokens: 200 },
    content: [{ text: '```javascript\nconsole.log("mocked response");\n```' }],
  }),
}));

jest.unstable_mockModule('../fileManager.js', () => ({
  default: {
    read: jest.fn().mockResolvedValue('file content'),
    write: jest.fn().mockResolvedValue(),
    getProjectStructure: jest.fn().mockResolvedValue({ 'index.js': null }),
  },
}));

jest.unstable_mockModule('../config.js', () => ({
  CONFIG: {
    languageConfigs: {
      javascript: {
        fileExtensions: ['.js', '.jsx'],
        linter: 'eslint',
        formatter: 'prettier',
        packageManager: 'npm',
      },
    },
    maxFileLines: 500,
  },
}));

jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: jest.fn().mockResolvedValue({ confirmSplit: true }),
  },
}));

// Import the modules after mocking
const CodeGenerator = (await import('../codeGenerator.js')).default;
const { getResponse } = await import('../model.js');

describe('CodeGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanGeneratedCode', () => {
    it('should extract code from a markdown block', () => {
      const code = '```javascript\nconst x = 1;\n```';
      const cleaned = CodeGenerator.cleanGeneratedCode(code);
      expect(cleaned).toBe('const x = 1;');
    });

    it('should return the original string if no markdown block is found', () => {
      const code = 'const x = 1;';
      const cleaned = CodeGenerator.cleanGeneratedCode(code);
      expect(cleaned).toBe('const x = 1;');
    });
  });

  describe('generate', () => {
    it('should call getResponse with a comprehensive prompt', async () => {
      await CodeGenerator.generate('README', 'console.log("old");', 'index.js', { 'index.js': null }, { 'other.js': 'content' });

      expect(getResponse).toHaveBeenCalledTimes(1);
      const prompt = getResponse.mock.calls[0][0];

      expect(prompt).toContain('README.md content:\nREADME');
      expect(prompt).toContain('Current index.js content (if exists):\nconsole.log("old");');
      expect(prompt).toContain('Project structure:');
      expect(prompt).toContain('other.js');
    });
  });

  describe('getLanguageFromExtension', () => {
    it('should return the correct language for a given extension', () => {
        const lang = CodeGenerator.getLanguageFromExtension('.js');
        expect(lang).toBe('javascript');
    });

    it('should return javascript as a default for unknown extensions', () => {
        const lang = CodeGenerator.getLanguageFromExtension('.foo');
        expect(lang).toBe('javascript');
    });
  });
});