// Mock for the 'chalk' library
// It simplifies chalk to a pass-through function for testing purposes.
const chalk = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'default') {
      return chalk;
    }
    // Return a function that returns the first argument, mimicking chalk's chaining.
    return (str) => str;
  }
});

export default chalk;