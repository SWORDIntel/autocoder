import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

describe('InferenceServerManager', () => {
  let inferenceServerManager;
  let mockServerProcess;
  let mockSpawn;
  let mockExecFile;

  beforeEach(async () => {
    jest.resetModules(); // Isolate each test

    // --- Mock all dependencies before importing the manager ---
    mockServerProcess = new EventEmitter();
    mockServerProcess.kill = jest.fn();
    mockServerProcess.stdout = new EventEmitter();
    mockServerProcess.stderr = new EventEmitter();
    mockSpawn = jest.fn().mockReturnValue(mockServerProcess);

    const mockHardwareReport = {
      compiler_flags: {
        environment: ['OPENVINO_HETERO_PRIORITY=NPU,GPU,CPU'],
      },
    };

    mockExecFile = jest.fn((command, args, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        cb(null, { stdout: JSON.stringify(mockHardwareReport) });
    });

    jest.unstable_mockModule('child_process', () => ({
      spawn: mockSpawn,
      execFile: mockExecFile,
    }));

    // Import a fresh instance for each test
    const module = await import('../inferenceServerManager.js');
    inferenceServerManager = module.default;

    // Mock console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should start the server with a prioritized device list', async () => {
    const startPromise = inferenceServerManager.start('/path/to/model');

    process.nextTick(() => {
        mockServerProcess.stdout.emit('data', 'Starting OpenVINO server on');
    });

    await startPromise;

    expect(mockExecFile).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      [
        expect.stringContaining('openvino_inference_server.py'),
        '--port', '5001',
        '--device', 'NPU,GPU,CPU'
      ],
      expect.any(Object)
    );
  });

  it('should reject the promise if the server fails to start', async () => {
    const startPromise = inferenceServerManager.start('/path/to/model');

    process.nextTick(() => {
        mockServerProcess.stderr.emit('data', 'Server cannot start');
    });

    await expect(startPromise).rejects.toThrow('Server cannot start');
  });

  it('should throw an error if no model path is provided', async () => {
    await expect(inferenceServerManager.start(null)).rejects.toThrow(
      'Cannot start inference server: No model path provided.'
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should stop the server process by sending a SIGINT signal', async () => {
    // Start the server first
    const startPromise = inferenceServerManager.start('/path/to/model');
    process.nextTick(() => {
        // Use the correct startup message
        mockServerProcess.stdout.emit('data', 'Starting OpenVINO server on');
    });
    await startPromise;

    // The stop() function returns a promise that resolves when the 'close' event is emitted.
    const stopPromise = inferenceServerManager.stop();

    // To test this, we emit the 'close' event on the mock process, which should resolve the promise.
    process.nextTick(() => {
        mockServerProcess.emit('close');
    });

    await stopPromise;

    expect(mockServerProcess.kill).toHaveBeenCalledWith('SIGINT');
  });

  it('should resolve immediately if stop is called when no server is running', async () => {
    await expect(inferenceServerManager.stop()).resolves.not.toThrow();
  });
});