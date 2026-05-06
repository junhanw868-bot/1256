'use strict';

// 平铺结构适配：所有模块都在同一目录下
const fetchService = require('./fetchService');
const { Notifier, createPushService } = require('./pushService');
const { StatsService } = require('./statsService');
const { CacheService } = require('./cacheService');
const { getFilterReason, filterList } = require('./filterService');
const { logger } = require('./logger');

const config = require(process.cwd() + '/../scripts/tyu/xbk_config.json');
const isDryRun = process.argv.includes('--dry-run');
const LOOP_LOG_INTERVAL = 24;
const STATS_WINDOW_HOURS = 2;

const domain = config.domain;
const fetchUrl = domain + '/plus/json/push.json';

function normalizeItem(item) {
  let normalized = item;
  if (item.id == null || item.id === '') {
    const newId = item.url || `unknown_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    normalized = { ...item, id: newId };
  }
  if (normalized.url) {
    if (!/^https?:\/\//i.test(normalized.url)) {
      normalized = { ...normalized, url: domain + normalized.url };
    }
  } else {
    logger.warn('数据缺少 url，使用空链接:', normalized.title);
    const idForUrl = normalized.id || 'no-id';
    normalized = { ...normalized, url: domain + '/missing/' + idForUrl };
  }
  return normalized;
}

const cacheFileName = fetchService.extractCacheFileName(fetchUrl);
const cacheService = new CacheService(cacheFileName, isDryRun);
const notifier = new Notifier(isDryRun);
const pushService = createPushService(notifier);
const statsService = new StatsService(STATS_WINDOW_HOURS, isDryRun);

let loopCount = 0;

async function main() {
  loopCount++;
  if (loopCount === 1 || loopCount % LOOP_LOG_INTERVAL === 0) {
    logger.info(`当前循环次数: ${loopCount}`);
    logger.info('开始获取线报酷数据...');
  }

  const list = await fetchService.getData(fetchUrl);
  if (!list) return;

  const normalized = list.map(normalizeItem);

  const cachedIds = cacheService.getCachedIds();
  const dedupSet = new Set();
  let dedupCount = 0;
  let titleHit = 0, contentHit = 0, categoryHit = 0, authorHit = 0, timeHit = 0;
  const toKeep = [];

  const filtered = filterList(normalized);
  for (const item of filtered) {
    if (cachedIds.has(item.id) || dedupSet.has(item.id)) {
      dedupCount++;
      continue;
    }
    dedupSet.add(item.id);

    const reason = getFilterReason(item);
    if (reason.keep) {
      toKeep.push(item);
    } else {
      if (reason.reasonType === 'title') titleHit++;
      else if (reason.reasonType === 'content') contentHit++;
      else if (reason.reasonType === 'category') categoryHit++;
      else if (reason.reasonType === 'author') authorHit++;
      else if (reason.reasonType === 'time') timeHit++;
    }
  }

  if (loopCount === 1 || loopCount % LOOP_LOG_INTERVAL === 0) {
    logger.info(`本次执行统计：去重 ${dedupCount} | 标题命中 ${titleHit} | 内容命中 ${contentHit} | 分类命中 ${categoryHit} | 作者命中 ${authorHit} | 时间命中 ${timeHit}`);
  }

  statsService.addRecord({
    dedup: dedupCount,
    titleHit,
    contentHit,
    categoryHit,
    authorHit,
    timeHit,
    pushed: toKeep.length
  });

  await pushService.sendBatch(toKeep);
  cacheService.addBatch(toKeep);

  if (loopCount % 20 === 0 || toKeep.length > 0) {
    const windowStats = statsService.getWindowStats();
    console.log(`\n近${STATS_WINDOW_HOURS}小时累计统计：去重 ${windowStats.dedup} 条 | 标题命中 ${windowStats.title} 条 | 内容命中 ${windowStats.content} 条 | 分类命中 ${windowStats.category} 条 | 作者命中 ${windowStats.author} 条 | 时间命中 ${windowStats.time} 条 | 已推送 ${windowStats.pushed} 条\n`);
  }

  if (toKeep.length > 0) {
    console.log('\n\n\n\n*************************************');
    console.log(`获取到${list.length}条数据，筛选后的新数据${toKeep.length}条，本次任务结束`);
  }
}

async function loop() {
  let delay = 5000;
  while (true) {
    try {
      await main();
      delay = 5000;
    } catch (err) {
      logger.error('单次执行异常:', err);
      delay = Math.min(delay * 2, 60000);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

loop().catch(err => {
  logger.error('循环崩溃:', err);
  process.exit(1);
});