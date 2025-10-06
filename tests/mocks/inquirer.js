import { jest } from '@jest/globals';

// Mock for the 'inquirer' library.
// This allows for simulating user prompts in tests.
export default {
  prompt: jest.fn().mockResolvedValue({}),
};