import { jest } from '@jest/globals';

describe('index.js', () => {
  let main;
  let TUI, CodeGenerator, chokidar;

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
        generate: jest.fn().mockResolvedValue('Generated code'),
      },
    }));
    jest.unstable_mockModule('chokidar', () => ({
      default: {
        watch: jest.fn(() => ({ on: jest.fn() })),
      },
    }));
    jest.unstable_mockModule('../inferenceServerManager.js', () => ({
        default: {
            start: jest.fn().mockResolvedValue(),
            stop: jest.fn().mockResolvedValue(),
        }
    }));


    // Re-import modules to apply mocks
    const indexModule = await import('../index.js');
    main = indexModule.main;

    TUI = (await import('../tui.js')).default;
    CodeGenerator = (await import('../codeGenerator.js')).default;
    chokidar = (await import('chokidar')).default;

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
    it('should create a TUI instance and call init by default', async () => {
      process.argv = ['node', 'index.js'];
      await main();
      expect(TUI).toHaveBeenCalledTimes(1);
      const tuiInstance = TUI.mock.results[0].value;
      expect(tuiInstance.init).toHaveBeenCalledTimes(1);
    });

    it('should call runWatchMode when --watch flag is provided', async () => {
      process.argv = ['node', 'index.js', '--watch'];
      await main();
      expect(chokidar.watch).toHaveBeenCalled();
      expect(TUI).not.toHaveBeenCalled();
    });

    it('should call runAutomatedMode when --generate flag is provided', async () => {
      process.argv = ['node', 'index.js', '--generate'];
      await main();
      expect(CodeGenerator.updateReadme).toHaveBeenCalled();
      expect(CodeGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(TUI).not.toHaveBeenCalled();
    });
  });
});