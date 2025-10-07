import { jest } from '@jest/globals';

// Mock for the 'ora' library.
// It provides a simplified, chainable mock object to simulate ora's behavior.
const ora = () => {
  const chainable = {
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
  };
  return chainable;
};

// Assign the 'default' property for ES module compatibility
ora.default = ora;

export default ora;