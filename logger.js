import ora from 'ora';

let logFunction = console.log;
let activeSpinner = null;

const logger = {
  log: (message) => {
    if (activeSpinner) {
      activeSpinner.text = message;
    } else if (logFunction) {
      logFunction(message);
    }
  },
  error: (message, error) => {
    if (activeSpinner) {
      activeSpinner.fail(message);
      activeSpinner = null;
    }
    console.error(message, error);
  },
  setLogFunction: (newLogFunction) => {
    logFunction = newLogFunction;
  },
  startSpinner: (message) => {
    if (activeSpinner) {
      activeSpinner.stop();
    }
    activeSpinner = ora(message).start();
  },
  stopSpinner: (success = true, message = '') => {
    if (activeSpinner) {
      if (success) {
        activeSpinner.succeed(message);
      } else {
        activeSpinner.fail(message);
      }
      activeSpinner = null;
    }
  },
};

export default logger;