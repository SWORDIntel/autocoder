// This is a manual mock for the 'chalk' library.
// It replaces the actual library during Jest tests.
// The goal is to prevent the real 'chalk' module from being loaded,
// thus avoiding the 'stripVTControlCharacters' import error.

// We use a Proxy to catch any property access (e.g., chalk.red, chalk.bold).
// For any property, we return a function that simply returns the string it was given.
// This satisfies the syntax `chalk.color('some string')` and returns 'some string'.
export default new Proxy(
  {},
  {
    get: (target, prop) => (str) => str,
  }
);