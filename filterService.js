'use strict';
const { compile, compileMany, safeTest } = require('./regexEngine');
const { TIME_CHECKER, daysComputed } = require('./timeEngine');
const { logger } = require('./logger');

let config;
try {
  config = require(process.cwd() + '/../scripts/tyu/xbk_config.json');
} catch (e) {
  logger.error('xbk_config.json 加载失败，请检查该文件是否存在及格式正确');
  process.exit(1);
}

const {
  zhanxianlouzhu,
  pingbilouzhu,
  pingbilouzhuplus,
  zhanxianbiaoti,
  pingbibiaoti,
  pingbibiaotiplus,
  zhanxianneirong,
  pingbineirong,
  pingbineirongplus,
  pingbifenlei
} = config;

const RULES = Object.freeze({
  zhanxianlouzhu: compileMany(zhanxianlouzhu),
  pingbilouzhu: compileMany(pingbilouzhu),
  pingbilouzhuplus: compileMany(pingbilouzhuplus),
  zhanxianbiaoti: compileMany(zhanxianbiaoti),
  pingbibiaoti: compileMany(pingbibiaoti),
  pingbibiaotiplus: compileMany(pingbibiaotiplus),
  zhanxianneirong: compileMany(zhanxianneirong),
  pingbineirong: compileMany(pingbineirong),
  pingbineirongplus: compileMany(pingbineirongplus)
});

const pingbifenleiReg = pingbifenlei ? compile(pingbifenlei) : null;

function checkTimeBlocked(group, catStr) {
  if (!TIME_CHECKER) return false;
  if (typeof group.louzhuregtime !== 'string') return false;
  const groupDays = daysComputed(group.louzhuregtime);
  return TIME_CHECKER(catStr, groupDays);
}

function getFilterReason(group) {
  if (!group || typeof group !== 'object') {
    logger.warn('getFilterReason 接收到无效 group，已忽略');
    return { keep: false, reasonType: 'invalid' };
  }

  const catStr = typeof group.catename === 'string'
    ? group.catename
    : (typeof group.category_name === 'string' ? group.category_name : null);
  const louzhuStr = typeof group.louzhu === 'string' ? group.louzhu : null;
  const titleStr = typeof group.title === 'string' ? group.title : null;
  const contentStr = typeof group.content === 'string' ? group.content : null;

  try {
    if (checkTimeBlocked(group, catStr)) {
      return { keep: false, reasonType: 'time' };
    }
  } catch (e) {
    logger.error('checkTimeBlocked 异常:', e.message);
  }

  if (catStr && pingbifenleiReg && pingbifenleiReg.test(catStr)) {
    return { keep: false, reasonType: 'category' };
  }

  const retainedSet = new Set();
  if (safeTest(RULES.zhanxianlouzhu, louzhuStr)) retainedSet.add('author');
  if (safeTest(RULES.zhanxianbiaoti, titleStr)) retainedSet.add('title');
  if (safeTest(RULES.zhanxianneirong, contentStr)) retainedSet.add('content');

  const shouldBlock = (dimension, rules, target) => {
    if (!target) return false;
    if (retainedSet.has(dimension)) return false;
    return safeTest(rules, target);
  };

  if (shouldBlock('author', RULES.pingbilouzhu, louzhuStr)) return { keep: false, reasonType: 'author' };
  if (shouldBlock('author', RULES.pingbilouzhuplus, louzhuStr)) return { keep: false, reasonType: 'author' };
  if (shouldBlock('title', RULES.pingbibiaoti, titleStr)) return { keep: false, reasonType: 'title' };
  if (shouldBlock('title', RULES.pingbibiaotiplus, titleStr)) return { keep: false, reasonType: 'title' };
  if (shouldBlock('content', RULES.pingbineirong, contentStr)) return { keep: false, reasonType: 'content' };
  if (shouldBlock('content', RULES.pingbineirongplus, contentStr)) return { keep: false, reasonType: 'content' };

  return { keep: true, reasonType: 'keep' };
}

function filterList(normalizedList) {
  return normalizedList.filter(item => getFilterReason(item).keep);
}

module.exports = { getFilterReason, filterList, RULES, pingbifenleiReg, checkTimeBlocked };