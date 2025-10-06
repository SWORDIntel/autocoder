import { jest } from '@jest/globals';

// This is a global manual mock for the 'inquirer' library.
// It replaces the actual library during all Jest tests.
// The goal is to prevent the real 'inquirer' module and its problematic
// dependency tree from being loaded, avoiding Jest's internal caching errors.
export default {
  prompt: jest.fn(),
};