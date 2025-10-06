import { jest } from '@jest/globals';

// Mock all dependencies of model.js
jest.unstable_mockModule('../settingsManager.js', () => ({
  default: {
    load: jest.fn().mockResolvedValue(),
    get: jest.fn((key) => {
      if (key === 'model') return 'claude-3.5-sonnet-20240620';
      if (key === 'temperature') return 0.7;
      return null;
    }),
    getApiKey: jest.fn().mockReturnValue('mock-api-key'),
  },
}));

jest.unstable_mockModule('../deepseek.js', () => ({
  getTextDeepseek: jest.fn().mockResolvedValue('deepseek-response'),
}));
jest.unstable_mockModule('../openai.js', () => ({
  getTextGpt: jest.fn().mockResolvedValue('openai-response'),
}));
jest.unstable_mockModule('../gemini.js', () => ({
  getTextGemini: jest.fn().mockResolvedValue('gemini-response'),
}));
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue('anthropic-response'),
    },
  })),
}));
jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({ data: { generated_text: 'openvino-response' } }),
  },
}));

// Import the function to be tested and its mocked dependencies
const { getResponse } = await import('../model.js');
const settingsManager = (await import('../settingsManager.js')).default;
const { getTextDeepseek } = await import('../deepseek.js');
const { getTextGpt } = await import('../openai.js');
const { getTextGemini } = await import('../gemini.js');
const Anthropic = (await import('@anthropic-ai/sdk')).default;
const axios = (await import('axios')).default;

describe('getResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call Anthropic for Claude models', async () => {
    settingsManager.get.mockImplementation((key) => {
        if (key === 'model') return 'claude-3-opus-20240229';
        return 0.7;
    });
    await getResponse('prompt');
    const anthropicInstance = Anthropic.mock.results[0].value;
    expect(anthropicInstance.messages.create).toHaveBeenCalled();
    expect(getTextGpt).not.toHaveBeenCalled();
    expect(getTextGemini).not.toHaveBeenCalled();
    expect(getTextDeepseek).not.toHaveBeenCalled();
  });

  it('should call getTextGpt for OpenAI models', async () => {
    await getResponse('prompt', 'o4-mini');
    expect(getTextGpt).toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });

  it('should call getTextGemini for Gemini models', async () => {
    await getResponse('prompt', 'gemini-1.5-pro-latest');
    expect(getTextGemini).toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });

  it('should call getTextDeepseek for Deepseek models', async () => {
    await getResponse('prompt', 'deepseek-coder');
    expect(getTextDeepseek).toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });

  it('should call axios.post for OpenVINO models', async () => {
    await getResponse('prompt', 'openvino_local');
    expect(axios.post).toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });

  it('should throw an error if no API key is found for Claude', async () => {
    settingsManager.getApiKey.mockReturnValue(null); // No API key
    await expect(getResponse('prompt', 'claude-3.5-sonnet-20240620')).rejects.toThrow(
      'Claude API key not found'
    );
  });
});