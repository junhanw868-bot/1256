'use strict';
const fs = require('node:fs');
const { getFilePath } = require('../storage/cacheService');
const { logger } = require('../utils/logger');

const STATS_WINDOW_HOURS = 2;

class StatsService {
  constructor(windowHours = STATS_WINDOW_HOURS, isDryRun = false) {
    this.filePath = getFilePath('stats.json');
    this.windowMs = windowHours * 60 * 60 * 1000;
    this.isDryRun = isDryRun;
    this.#ensureFile();
  }

  #ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', 'utf8');
    }
  }

  #loadRecords() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      logger.warn('统计文件读取失败，已忽略:', e.message);
      return [];
    }
  }

  #saveRecords(records) {
    const cutoff = Date.now() - this.windowMs;
    const toSave = records
      .filter(r => r.ts >= cutoff)
      .slice(-1440);
    fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), 'utf8');
  }

  addRecord(record) {
    if (this.isDryRun) return;
    const records = this.#loadRecords();
    records.push({ ts: Date.now(), ...record });
    this.#saveRecords(records);
  }

  getWindowStats() {
    const cutoff = Date.now() - this.windowMs;
    const records = this.#loadRecords().filter(r => r.ts >= cutoff);
    const sum = (key) => records.reduce((acc, r) => acc + (r[key] || 0), 0);
    return {
      dedup: sum('dedup'),
      title: sum('titleHit'),
      content: sum('contentHit'),
      category: sum('categoryHit'),
      author: sum('authorHit'),
      time: sum('timeHit'),
      pushed: sum('pushed')
    };
  }
}

module.exports = { StatsService, STATS_WINDOW_HOURS };