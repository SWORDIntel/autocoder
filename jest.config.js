export default {
  testEnvironment: 'node',
  // Required for ES Modules support in Jest
  transform: {},
  // Tells Jest to look for .js and .mjs files
  moduleFileExtensions: ['js', 'mjs'],
  // Pattern for discovering test files
  testMatch: ['**/tests/**/*.test.js'],
  // Ignore node_modules
  testPathIgnorePatterns: ['/node_modules/'],
  // This helps Jest resolve module paths correctly with ESM
  moduleNameMapper: {
    // Adjusts module paths to work with ESM
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock problematic CommonJS modules that cause issues with ESM tests
    '^chalk$': '<rootDir>/tests/mocks/chalk.js',
    '^inquirer$': '<rootDir>/tests/mocks/inquirer.js',
    '^ora$': '<rootDir>/tests/mocks/ora.js',
    '^blessed$': '<rootDir>/tests/mocks/blessed.js',
  },
};