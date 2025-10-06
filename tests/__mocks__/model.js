import { jest } from '@jest/globals';

// This is a global manual mock for the 'model.js' module.
// It replaces the actual module during all Jest tests to prevent
// loading of external AI SDKs, which cause Jest caching errors.
export const getResponse = jest.fn();