import { jest } from '@jest/globals';

// --- Mocks Setup ---
// These are hoisted and will apply to all dynamic imports of the mocked modules.

const mockTuiInstance = {
  init: jest.fn(),
  processFiles: jest.fn(),
  screen: { destroy: jest.fn() },
};
jest.unstable_mockModule('../tui.js', () => ({
  __esModule: true,
  default: jest.fn(() => mockTuiInstance),
}));

const mockFileManager = {
  read: jest.fn(),
  write: jest.fn(),
  getProjectStructure: jest.fn(),
  getFilesToProcess: jest.fn(),
};
jest.unstable_mockModule('../fileManager.js', () => ({
  __esModule: true,
  default: mockFileManager,
}));

const mockCodeGenerator = {
  updateReadme: jest.fn(),
};
jest.unstable_mockModule('../codeGenerator.js', () => ({
  __esModule: true,
  default: mockCodeGenerator,
}));

const mockWatcher = {
  on: jest.fn(),
  close: jest.fn(),
};
const mockChokidarWatch = jest.fn(() => mockWatcher);
jest.unstable_mockModule('chokidar', () => ({
  __esModule: true,
  default: {
    watch: mockChokidarWatch,
  },
}));

// --- Global/Process Mocks ---
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  if (code !== 0) {
    throw new Error(`process.exit called with code ${code}`);
  }
  return undefined;
});
const originalArgv = process.argv;
global.console = {
    log: jest.fn(), error: jest.fn(), cyan: jest.fn(),
    yellow: jest.fn(), blue: jest.fn(), green: jest.fn(),
};

// --- Test Suite ---
describe('index.js - Main Entry Point', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = [...originalArgv];
  });

  afterAll(() => {
    process.argv = originalArgv;
    mockExit.mockRestore();
  });

  it('should start the TUI by default when no arguments are provided', async () => {
    await jest.isolateModulesAsync(async () => {
        process.argv = ['node', 'index.js'];
        const { main, tui } = await import('../index.js');
        // Call main but don't await it, since it returns a non-resolving promise in TUI mode
        main();
        // Allow the event loop to proceed once
        await new Promise(resolve => setImmediate(resolve));
        // The init call should have been made synchronously within main
        expect(tui.init).toHaveBeenCalled();
    });
  });

  it('should run in watch mode when --watch argument is provided', async () => {
    await jest.isolateModulesAsync(async () => {
        process.argv = ['node', 'index.js', '--watch'];
        const { main } = await import('../index.js');
        main(); // Don't await, as this also runs indefinitely
        await new Promise(resolve => setImmediate(resolve));
        expect(mockChokidarWatch).toHaveBeenCalled();
        expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  it('should run in automated mode when generate arguments are provided', async () => {
    await jest.isolateModulesAsync(async () => {
        process.argv = ['node', 'index.js', 'generate', 'claude-3.5', 'sk-12345'];

        mockFileManager.read.mockResolvedValue('README content');
        mockFileManager.getProjectStructure.mockResolvedValue({});
        mockFileManager.getFilesToProcess.mockResolvedValue(['file1.js']);
        mockCodeGenerator.updateReadme.mockResolvedValue('Updated README');

        const { main } = await import('../index.js');
        await main();

        expect(mockFileManager.read).toHaveBeenCalled();
        expect(mockCodeGenerator.updateReadme).toHaveBeenCalled();
        expect(mockTuiInstance.processFiles).toHaveBeenCalled();
        expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  it('should exit with an error in automated mode if README is not found', async () => {
    await jest.isolateModulesAsync(async () => {
        process.argv = ['node', 'index.js', 'generate', 'model', 'key'];
        mockFileManager.read.mockResolvedValue(null);

        const { main } = await import('../index.js');

        await expect(main()).rejects.toThrow('process.exit called with code 1');

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('README.md not found'));
        expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});