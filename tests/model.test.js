import { jest } from '@jest/globals';

// Mock dependencies of the new local-only model.js
jest.unstable_mockModule('../settingsManager.js', () => ({
  default: {
    load: jest.fn().mockResolvedValue(),
    get: jest.fn(), // Implementation will be set in beforeEach
  },
}));

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({ data: { generated_text: 'local-openvino-response' } }),
  },
}));

jest.unstable_mockModule('../config.js', () => ({
    CONFIG: {
        localOpenVinoServerUrl: 'http://localhost:5001/generate'
    }
}));


// Import the function to be tested and its mocked dependencies
const { getResponse } = await import('../model.js');
const settingsManager = (await import('../settingsManager.js')).default;
const axios = (await import('axios')).default;

describe('getResponse (Local-Only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to a default successful state before each test
    settingsManager.get.mockImplementation((key) => {
        if (key === 'model') return '/path/to/mock/model';
        return null;
    });
    axios.post.mockResolvedValue({ data: { generated_text: 'local-openvino-response' } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
      jest.restoreAllMocks();
  });

  it('should call the local OpenVINO server with the correct model path', async () => {
    await getResponse('test prompt');

    expect(settingsManager.load).toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5001/generate',
      expect.objectContaining({
        prompt: 'test prompt',
        model_path: '/path/to/mock/model',
      }),
      expect.any(Object)
    );
  });

  it('should return the generated text from the server response', async () => {
    const response = await getResponse('test prompt');
    expect(response.content[0].text).toBe('local-openvino-response');
  });

  it('should throw an error if no model path is selected', async () => {
    settingsManager.get.mockReturnValue(null); // Simulate no model being set for this specific test
    await expect(getResponse('test prompt')).rejects.toThrow(
      'No local model selected. Please select a model using the /model command.'
    );
  });

  it('should throw an error if the server response is malformed', async () => {
    axios.post.mockResolvedValue({ data: { wrong_key: 'some-data' } }); // Malformed response for this test
    await expect(getResponse('test prompt')).rejects.toThrow(
      "Local OpenVINO server response format error. Missing 'generated_text'."
    );
  });

  it('should handle network errors when calling the server', async () => {
    const networkError = new Error('Network error');
    axios.post.mockRejectedValue(networkError); // Network error for this test
    await expect(getResponse('test prompt')).rejects.toThrow(
        `Error making request to OpenVINO server: ${networkError.message}`
    );
  });
});