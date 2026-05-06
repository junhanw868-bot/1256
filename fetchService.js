'use strict';
const { fetch } = require('undici');
const { logger } = require('./logger');

const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_RETRY_LIMIT = 2;

async function httpGet(url, { timeout, retry, headers } = {}) {
  const maxAttempts = retry + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status >= 500 && attempt < maxAttempts) continue;
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const body = await res.text();
      return { statusCode: res.status, body };
    } catch (err) {
      clearTimeout(timer);
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
}

function parseResponseBody(body) {
  if (!body || body.trim() === "") {
    logger.warn('服务器返回了空内容，跳过本次执行');
    return null;
  }
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    logger.warn('数据格式异常，非列表');
    return null;
  } catch (e) {
    logger.error('返回内容不是合法 JSON，可能是触发了防火墙或网络中断');
    logger.error('响应片段:', body.slice(0, 300));
    return null;
  }
}

function extractCacheFileName(url) {
  let filename;
  try {
    filename = require('node:path').basename(new URL(url).pathname);
  } catch {
    const parts = url.split('/');
    filename = parts[parts.length - 1];
  }
  if (!filename?.endsWith('.json')) {
    filename = (filename || 'push.json') + '.json';
  }
  return filename;
}

async function getData(url) {
  try {
    const response = await httpGet(url, {
      timeout: REQUEST_TIMEOUT_MS,
      retry: REQUEST_RETRY_LIMIT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url.replace(/\/plus\/json\/push\.json$/, '/'),
        'Accept': 'application/json, text/plain, */*'
      }
    });
    const { statusCode, body } = response;
    if (statusCode === 200) {
      logger.info(`请求成功，状态码: ${statusCode}，响应体长度: ${body.length}`);
    } else {
      logger.warn(`服务器返回非 200 状态码: ${statusCode}，响应内容: ${body.slice(0, 200)}`);
    }
    if (!body || body.trim() === '') {
      logger.warn('响应体为空，可能是服务器拒绝了请求或网络不稳定');
      return null;
    }
    return parseResponseBody(body);
  } catch (error) {
    if (error.response) {
      logger.error(`请求失败，状态码: ${error.response.statusCode}`);
    } else if (error.code === 'ETIMEDOUT') {
      logger.error('请求超时:', error.message);
    } else {
      logger.error('请求错误:', error.message);
    }
    return null;
  }
}

module.exports = { getData, httpGet, parseResponseBody, extractCacheFileName, REQUEST_TIMEOUT_MS, REQUEST_RETRY_LIMIT };