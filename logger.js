'use strict';

const LOG_LEVEL = Object.freeze({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 });
const CURRENT_LOG_LEVEL = LOG_LEVEL.INFO;

function selectLogFunction(level) {
  if (level >= LOG_LEVEL.ERROR) return console.error;
  if (level >= LOG_LEVEL.WARN) return console.warn;
  return console.log;
}

const logger = {
  _log(level, prefix, ...args) {
    if (level < CURRENT_LOG_LEVEL) return;
    const fn = selectLogFunction(level);
    fn(`[${prefix}]`, ...args);
  },
  debug(...args) { this._log(LOG_LEVEL.DEBUG, 'DEBUG', ...args); },
  info(...args) { this._log(LOG_LEVEL.INFO, 'INFO', ...args); },
  warn(...args) { this._log(LOG_LEVEL.WARN, 'WARN', ...args); },
  error(...args) { this._log(LOG_LEVEL.ERROR, 'ERROR', ...args); }
};

module.exports = { LOG_LEVEL, CURRENT_LOG_LEVEL, logger };