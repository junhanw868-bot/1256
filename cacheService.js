'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { logger } = require('./logger');

const EMPTY_JSON_ARRAY = '[]';
const UTF8 = 'utf8';
const CACHE_DIR_NAME = 'xianbaoku_cache';
const MAX_CACHE_SIZE = 500;

const DATA_DIR = path.join(__dirname, '..', CACHE_DIR_NAME);
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  logger.error('创建缓存目录失败，后续读写可能出错:', e.message);
}

function getFilePath(filename) {
  return path.join(DATA_DIR, filename);
}

class CacheService {
  constructor(filename, isDryRun = false) {
    this.filePath = getFilePath(filename);
    this.isDryRun = isDryRun;
    this.#ensureFile();
  }

  #ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, EMPTY_JSON_ARRAY, UTF8);
      } catch (err) {
        logger.error(`无法创建缓存文件 ${this.filePath}:`, err.message);
      }
    }
  }

  #parse() {
    try {
      const raw = fs.readFileSync(this.filePath, UTF8);
      const data = JSON.parse(raw || EMPTY_JSON_ARRAY);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      logger.error(`JSON解析错误，重置文件 ${this.filePath}:`, e.message);
      try {
        fs.writeFileSync(this.filePath, EMPTY_JSON_ARRAY, UTF8);
      } catch (writeErr) {
        logger.error(`无法重置缓存文件 ${this.filePath}:`, writeErr.message);
      }
      return [];
    }
  }

  #serialize(messages) {
    try {
      return JSON.stringify(messages, null, 2);
    } catch (e) {
      logger.error('无法序列化对象:', e.message);
      return EMPTY_JSON_ARRAY;
    }
  }

  getCachedIds() {
    const msgs = this.#parse();
    return new Set(msgs.map(m => m?.id).filter(Boolean));
  }

  addItem(item) {
    if (this.isDryRun) {
      logger.info(`[DRY-RUN] 跳过写入缓存: ${item.id} - ${item.title}`);
      return;
    }
    try {
      const messages = this.#parse();
      const idx = messages.findIndex(m => m.id === item.id);
      const enriched = { ...item, timestamp: new Date().toISOString() };
      if (idx >= 0) {
        messages[idx] = enriched;
      } else {
        messages.push(enriched);
        if (messages.length > MAX_CACHE_SIZE) {
          messages.splice(0, messages.length - MAX_CACHE_SIZE);
        }
      }
      fs.writeFileSync(this.filePath, this.#serialize(messages), UTF8);
    } catch (err) {
      logger.error(`写入缓存失败 [${path.basename(this.filePath)}]:`, err.message);
    }
  }

  addBatch(items) {
    for (const item of items) {
      this.addItem(item);
    }
  }
}

module.exports = { CacheService, EMPTY_JSON_ARRAY, UTF8, MAX_CACHE_SIZE, getFilePath, DATA_DIR };