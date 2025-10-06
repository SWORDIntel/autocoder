import { jest } from '@jest/globals';

describe('index.js', () => {
  let main, runWatchMode, runAutomatedMode;
  let TUI, CodeGenerator, chokidar, tuiInstance;

  let originalArgv;
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(async () => {
    jest.resetModules(); // Reset module cache to get a fresh instance for each test

    // Mock dependencies before re-importing modules
    jest.unstable_mockModule('../tui.js', () => ({
      default: jest.fn(() => ({
        init: jest.fn().mockResolvedValue(),
        processFiles: jest.fn().mockResolvedValue(),
      })),
    }));
    jest.unstable_mockModule('../fileManager.js', () => ({
      default: {
        read: jest.fn().mockResolvedValue('README content'),
        getProjectStructure: jest.fn().mockResolvedValue({}),
        getFilesToProcess: jest.fn().mockResolvedValue(['file1.js']),
        write: jest.fn().mockResolvedValue(),
      },
    }));
    jest.unstable_mockModule('../codeGenerator.js', () => ({
      default: {
        updateReadme: jest.fn().mockResolvedValue('Updated README'),
      },
    }));
    jest.unstable_mockModule('chokidar', () => ({
      default: {
        watch: jest.fn(() => ({ on: jest.fn() })),
      },
    }));

    // Re-import modules to apply mocks
    const indexModule = await import('../index.js');
    main = indexModule.main;
    runWatchMode = indexModule.runWatchMode;
    runAutomatedMode = indexModule.runAutomatedMode;

    TUI = (await import('../tui.js')).default;
    CodeGenerator = (await import('../codeGenerator.js')).default;
    chokidar = (await import('chokidar')).default;

    // Get the singleton TUI instance created during module import
    tuiInstance = TUI.mock.results[0].value;

    // Store original process.argv and clear mocks that need resetting
    originalArgv = process.argv;
    mockExit.mockClear();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    // Restore original process.argv
    process.argv = originalArgv;
  });

  describe('main function argument parsing', () => {
    it('should call tui.init by default with no arguments', async () => {
      process.argv = ['node', 'index.js'];
      await main();
      expect(tuiInstance.init).toHaveBeenCalled();
    });

    it('should call runWatchMode when --watch flag is provided', async () => {
      process.argv = ['node', 'index.js', '--watch'];
      await main();
      expect(chokidar.watch).toHaveBeenCalled();
    });

    it('should call runAutomatedMode with correct arguments', async () => {
      process.argv = ['node', 'index.js', 'generate', 'claude', 'test-api-key'];
      await main();
      expect(CodeGenerator.updateReadme).toHaveBeenCalled();
      expect(tuiInstance.processFiles).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('runAutomatedMode', () => {
    it('should call CodeGenerator.updateReadme and tui.processFiles', async () => {
        await runAutomatedMode('claude', 'test-key');
        expect(CodeGenerator.updateReadme).toHaveBeenCalled();
        expect(tuiInstance.processFiles).toHaveBeenCalled();
        expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});