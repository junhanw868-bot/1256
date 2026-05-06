'use strict';
const RE2 = require('re2');
const { logger } = require('../utils/logger');

const MAX_MATCH_TARGET_LEN = 3000;

function compile(pattern) {
  if (!pattern) return null;
  try {
    return new RE2(pattern, 'i');
  } catch (e) {
    logger.error(`正则编译失败：/${pattern}/，原因：${e.message}`);
    return null;
  }
}

function compileMany(str) {
  if (!str) return null;

  const patterns = str
    .split(/\r\n|\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const validPatterns = [];
  for (const p of patterns) {
    if (compile(p)) {
      validPatterns.push(p);
    }
  }

  if (validPatterns.length === 0) return null;
  return compile(validPatterns.join('|'));
}

function safeTest(regex, targetStr) {
  if (!regex || !targetStr) return false;
  const safeTarget = targetStr.length > MAX_MATCH_TARGET_LEN
    ? targetStr.slice(0, Math.ceil(MAX_MATCH_TARGET_LEN / 2)) +
      targetStr.slice(-Math.floor(MAX_MATCH_TARGET_LEN / 2))
    : targetStr;
  return regex.test(safeTarget);
}

module.exports = { compile, compileMany, safeTest, MAX_MATCH_TARGET_LEN };