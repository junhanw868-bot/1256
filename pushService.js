'use strict';
const notify = require('../xbk_sendNotify');
const htmlUtils = require('../utils/htmlUtils');
const { logger } = require('../utils/logger');

function tuisong_replace(template, shuju) {
  const data = {
    ...shuju,
    catename: shuju.catename || shuju.category_name,
    category_name: shuju.category_name || shuju.catename,
    datetime: shuju.posttime ? htmlUtils.buildDateTime(shuju.posttime) : '',
    shorttime: shuju.posttime ? htmlUtils.buildShortTime(shuju.posttime) : '',
  };

  const contentHtml = htmlUtils.buildContentHtml(shuju);

  const map = {
    '{标题}': data.title,
    '{内容}': data.content,
    '{Html内容}': contentHtml,
    '{Markdown内容}': template.includes('{Markdown内容}') ? htmlUtils.htmlToMarkdown(shuju) : '',
    '{分类名}': data.catename,
    '{分类ID}': data.cateid,
    '{链接}': data.url,
    '{日期}': data.datetime,
    '{时间}': data.shorttime,
    '{楼主}': data.louzhu,
    '{类目}': data.category_name,
    '{价格}': data.price,
    '{商城}': data.mall_name,
    '{品牌}': data.brand,
    '{图片}': data.pic
  };

  const placeholderRegex = /\{[^}]+\}/g;
  return template.replace(placeholderRegex, (match) => {
    const val = map[match];
    return val !== undefined ? (val ?? '') : match;
  });
}

class Notifier {
  constructor(isDryRun) {
    this.isDryRun = isDryRun;
  }
  async send(title, content) {
    if (this.isDryRun) {
      logger.info(`[DRY-RUN] 跳过推送: ${title}`);
      return;
    }
    try {
      await notify.sendNotify(title, content);
      logger.info(`[PUSH] 成功: ${title}`);
    } catch (err) {
      logger.error(`[PUSH] 失败: ${title}, ${err.message}`);
    }
  }
}

function createPushService(notifier) {
  async function sendBatch(items) {
    for (const item of items) {
      await notifier.send(
        tuisong_replace('【{分类名}】{标题}', item),
        tuisong_replace('<h5>{标题}</h5><br>{Html内容}', item)
      );
      console.log('------------------------------------------------------------------');
      console.log(`发现新数据:${item.title}【${item.catename || item.category_name}】${item.url}`);
    }
  }
  return { sendBatch };
}

module.exports = { Notifier, tuisong_replace, createPushService };