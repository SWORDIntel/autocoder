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
const FileManager = (await import('../fileManager.js')).default;
const inquirer = (await import('inquirer')).default;

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

  describe('parseFileBlocks', () => {
    it('should parse multiple file blocks from a response', () => {
      const response = `
# File: src/index.js
\`\`\`javascript
console.log('hello');
\`\`\`

# File: src/utils.js
\`\`\`javascript
export const util = () => {};
\`\`\`
      `;
      const files = CodeGenerator.parseFileBlocks(response);
      expect(Object.keys(files)).toHaveLength(2);
      expect(files['src/index.js']).toBe("console.log('hello');");
      expect(files['src/utils.js']).toBe('export const util = () => {};');
    });
  });

  describe('generate', () => {
    it('should call getResponse with a comprehensive prompt', async () => {
      // Mock analyzeProjectStyle to prevent the first, unwanted call to getResponse
      jest.spyOn(CodeGenerator, 'analyzeProjectStyle').mockResolvedValue('Mocked Style Guide');

      await CodeGenerator.generate('README', 'console.log("old");', 'index.js', { 'index.js': null }, { 'other.js': 'content' });

      // Now the first call to getResponse is the one from the generate function.
      expect(getResponse).toHaveBeenCalledTimes(1);
      const prompt = getResponse.mock.calls[0][0];

      expect(prompt).toContain('README.md content:\nREADME');
      expect(prompt).toContain('Current index.js content (if exists):\nconsole.log("old");');
      expect(prompt).toContain('Project structure:');
      expect(prompt).toContain('other.js');
      expect(prompt).toContain('--- STYLE GUIDE ---\nMocked Style Guide');
    });
  });

  describe('generateMultiFile', () => {
    it('should generate multiple files from a prompt', async () => {
        const mockResponse = `
# File: src/feature/service.js
\`\`\`javascript
// Service
\`\`\`

# File: src/feature/component.js
\`\`\`javascript
// Component
\`\`\`
        `;
        getResponse.mockResolvedValue({ content: [{ text: mockResponse }], usage: {} });

        const mockUi = { log: jest.fn() };
        await CodeGenerator.generateMultiFile('new feature', {}, mockUi);

        expect(FileManager.write).toHaveBeenCalledTimes(2);
        expect(FileManager.write).toHaveBeenCalledWith('src/feature/service.js', '// Service');
        expect(FileManager.write).toHaveBeenCalledWith('src/feature/component.js', '// Component');
        expect(mockUi.log).toHaveBeenCalledWith('✅ Created file: src/feature/service.js');
        expect(mockUi.log).toHaveBeenCalledWith('✅ Created file: src/feature/component.js');
    });
  });

  describe('scaffold', () => {
    it('should create a new file from a scaffold prompt', async () => {
        const mockResponse = {
            filePath: 'src/components/New.js',
            code: 'export default () => {};',
        };
        getResponse.mockResolvedValue({ content: [{ text: JSON.stringify(mockResponse) }], usage: {} });

        const mockUi = { log: jest.fn() };
        await CodeGenerator.scaffold('new component', {}, mockUi);

        expect(FileManager.write).toHaveBeenCalledWith('src/components/New.js', 'export default () => {};');
        expect(mockUi.log).toHaveBeenCalledWith('✅ New component created at src/components/New.js');
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