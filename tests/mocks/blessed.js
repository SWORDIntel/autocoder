import { jest } from '@jest/globals';

// Mock for the 'blessed' library.
// It provides a basic structure for TUI components to be tested in a non-terminal environment.
const blessed = {
  screen: jest.fn(() => ({
    on: jest.fn(),
    append: jest.fn(),
    render: jest.fn(),
    destroy: jest.fn(),
    key: jest.fn(),
  })),
  box: jest.fn((options) => ({
    ...options,
    on: jest.fn(),
    setContent: jest.fn(),
  })),
  list: jest.fn((options) => ({
    ...options,
    on: jest.fn(),
    focus: jest.fn(),
    setItems: jest.fn(),
    getItem: jest.fn(),
    select: jest.fn(),
    selected: 0,
  })),
};

export default blessed;