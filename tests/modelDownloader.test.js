import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

describe('ModelDownloader', () => {
  let modelDownloader;
  let mockSpawn;
  let mockFs;
  let mockGitProcess;
  let logger;

  beforeEach(async () => {
    jest.resetModules();

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
    jest.unstable_mockModule('../logger.js', () => ({
        default: {
          log: jest.fn(),
          error: jest.fn(),
        },
    }));

    const module = await import('../modelDownloader.js');
    modelDownloader = module.default;
    logger = (await import('../logger.js')).default;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully clone a model repository', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const downloadPromise = modelDownloader.download('Intel/neural-chat-7b-v3-1-int8-ov');

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

    await modelDownloader.download('Intel/neural-chat-7b-v3-1-int8-ov');

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('already exists. Skipping download.'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should reject the promise if git clone fails', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const downloadPromise = modelDownloader.download('invalid/model');

    process.nextTick(() => {
        const errorMessage = 'Repository not found';
        mockGitProcess.stderr.emit('data', errorMessage);
        mockGitProcess.emit('close', 128);
    });

    await expect(downloadPromise).rejects.toThrow('Repository not found');
  });

  it('should ensure the models directory exists', async () => {
    mockFs.access.mockResolvedValue();
    await modelDownloader.download('some/model');
    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('models'), { recursive: true });
  });
});