'use strict';
const { compile } = require('./regexEngine');
const { logger } = require('./logger');

let config;
try {
  config = require('../xbk_config.json');
} catch (e) {
  logger.error('xbk_config.json 加载失败，请检查该文件是否存在及格式正确');
  process.exit(1);
}

const MS_PER_DAY = 86400000;

function daysComputed(dateStr) {
  let dt = null;
  const ts = dateStr;

  if (typeof ts === 'number') {
    const ms = ts < 1e12 ? ts * 1000 : ts;
    dt = new Date(ms);
  } else if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
      const parts = ts.split('-');
      dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    } else if (!isNaN(d.getTime())) {
      dt = d;
    }
  }

  if (!dt) return Infinity;

  const targetDate = dt;
  if (!(targetDate instanceof Date) || isNaN(targetDate.getTime())) return Infinity;

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayDate - targetDate;
  if (diff < 0) return Infinity;
  return Math.floor(diff / MS_PER_DAY);
}

function parseTimeRule(rawRule) {
  const parts = rawRule.split('###');
  if (parts.length < 2) {
    logger.warn(`时间规则格式错误：缺少 "###" 分隔符，原始字符串: ${rawRule}`);
    return null;
  }
  if (parts.length > 2) {
    logger.warn(`时间规则包含多余 "###"，仅取前两段: ${rawRule}`);
  }
  const catPattern = parts[0];
  const daysStr = parts[1];
  const days = Number(daysStr);
  if (!catPattern || catPattern.trim() === '') {
    logger.warn(`时间规则分类名为空，已忽略: ${rawRule}`);
    return null;
  }
  if (Number.isNaN(days)) {
    logger.warn(`时间规则天数无效: "${daysStr}"，已忽略规则: ${rawRule}`);
    return null;
  }
  const catRegex = compile(catPattern);
  if (!catRegex) {
    logger.warn(`时间规则分类正则无效，已忽略: ${rawRule}`);
    return null;
  }
  return (catStr, groupDays) => catStr && catRegex.test(catStr) && groupDays <= days;
}

function compileTimeRules() {
  const pingbitime = config.pingbitime;
  const normalizedPingbitime = pingbitime == null ? pingbitime : String(pingbitime).trim();
  if (normalizedPingbitime == null || normalizedPingbitime === '') return null;
  const timeStr = normalizedPingbitime;

  if (!timeStr.includes('###')) {
    const limitDays = Number(timeStr);
    if (Number.isNaN(limitDays)) return null;
    return (catStr, groupDays) => groupDays <= limitDays;
  }

  const rules = timeStr
    .split(/<br\s*\/?>|\r\n|\n/i)
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(line => parseTimeRule(line))
    .filter(Boolean);
  if (rules.length === 0) {
    logger.warn('pingbitime 未生成任何有效时间规则，已禁用时间屏蔽');
    return null;
  }
  return (catStr, groupDays) => rules.some(fn => fn(catStr, groupDays));
}

const TIME_CHECKER = compileTimeRules();

module.exports = { daysComputed, parseTimeRule, compileTimeRules, TIME_CHECKER, MS_PER_DAY };