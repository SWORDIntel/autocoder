import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

describe('ModelDownloader', () => {
  let modelDownloader;
  let mockSpawn;
  let mockFs;
  let mockGitProcess;
  const mockUi = { log: jest.fn() };

  beforeEach(async () => {
    jest.resetModules(); // Isolate each test

    // Mock dependencies before importing the downloader
    mockGitProcess = new EventEmitter();
    mockGitProcess.stderr = new EventEmitter();
    mockSpawn = jest.fn().mockReturnValue(mockGitProcess);

    mockFs = {
      mkdir: jest.fn().mockResolvedValue(),
      access: jest.fn(),
    };

    jest.unstable_mockModule('child_process', () => ({
      spawn: mockSpawn,
    }));
    jest.unstable_mockModule('fs/promises', () => ({
      default: mockFs,
    }));

    // Import a fresh instance for each test
    const module = await import('../modelDownloader.js');
    modelDownloader = module.default;

    // Mock console to keep test output clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUi.log.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully clone a model repository', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const downloadPromise = modelDownloader.download('Intel/neural-chat-7b-v3-1-int8-ov', mockUi);

    process.nextTick(() => {
        mockGitProcess.emit('close', 0);
    });

    await downloadPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', 'https://huggingface.co/Intel/neural-chat-7b-v3-1-int8-ov', expect.stringContaining('models/neural-chat-7b-v3-1-int8-ov')],
      expect.any(Object)
    );
  });

  it('should skip downloading if the model directory already exists', async () => {
    mockFs.access.mockResolvedValue();

    await modelDownloader.download('Intel/neural-chat-7b-v3-1-int8-ov', mockUi);

    expect(mockUi.log).toHaveBeenCalledWith(expect.stringContaining('already exists. Skipping download.'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should reject the promise if git clone fails', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const downloadPromise = modelDownloader.download('invalid/model', mockUi);

    process.nextTick(() => {
        const errorMessage = 'Repository not found';
        mockGitProcess.stderr.emit('data', errorMessage);
        mockGitProcess.emit('close', 128);
    });

    await expect(downloadPromise).rejects.toThrow('Repository not found');
  });

  it('should ensure the models directory exists', async () => {
    mockFs.access.mockResolvedValue(); // Pretend model exists to stop before spawn
    await modelDownloader.download('some/model', mockUi);
    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('models'), { recursive: true });
  });
});