export default {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    "conditions": ["node", "node-addons"],
  },
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  moduleNameMapper: {
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.js',
    '^inquirer$': '<rootDir>/tests/__mocks__/inquirer.js',
    '\\./model.js$': '<rootDir>/tests/__mocks__/model.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.js$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.ts',
  ],
};