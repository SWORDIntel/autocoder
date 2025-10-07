let logFunction = console.log;

const logger = {
  log: (message) => {
    if (logFunction) {
      logFunction(message);
    }
  },
  error: (message, error) => {
    console.error(message, error);
  },
  setLogFunction: (newLogFunction) => {
    logFunction = newLogFunction;
  },
};

export default logger;