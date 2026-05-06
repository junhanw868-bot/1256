'use strict';

const CONTENT_BR_SPACER = '<br> <br> <br>';
const ORIGINAL_LINK_HTML = (url) => `原文链接:<a href="${url}" target="_blank">${url}</a><br> <br> <br>`;

const padTwo = (num) => String(num).padStart(2, '0');

const RE_H = /<h([1-6])>(.*?)<\/h\1>/gi;
const RE_A = /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
const RE_IMG = /<img[^>]+src="([^"]+)"[^>]*>/gi;
const RE_BR = /<br\s*\/?>/gi;
const RE_P_OPEN = /<p[^>]*>/gi;
const RE_P_CLOSE = /<\/p>/gi;
const RE_ANY_TAG = /<[^>]+>/g;
const RE_MULTI_NEWLINE = /\n{3,}/g;

function htmlToMarkdown(shuju) {
  let html = shuju.content_html || '';
  html = html.replaceAll(RE_H, (_, level, content) => '#'.repeat(Number(level)) + ' ' + content + '\n\n');
  html = html.replaceAll(RE_A, '$2');
  html = html.replaceAll(RE_IMG, '[图片]\n\n');
  html = html.replaceAll(RE_BR, '\n\n');
  html = html.replaceAll(RE_P_OPEN, '\n\n');
  html = html.replaceAll(RE_P_CLOSE, '\n\n');
  html = html.replaceAll(RE_ANY_TAG, '');
  html = html.replaceAll(RE_MULTI_NEWLINE, '\n\n');
  html = `${html}\n\n原文链接:${shuju.url}\n\n\n\n`;
  return html.trim();
}

function buildDateTime(posttime) {
  const d = new Date(posttime * 1000);
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

function buildShortTime(posttime) {
  const d = new Date(posttime * 1000);
  return `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
}

function buildContentHtml(shuju) {
  return (shuju.content_html || '') + CONTENT_BR_SPACER + ORIGINAL_LINK_HTML(shuju.url);
}

module.exports = {
  padTwo,
  buildDateTime,
  buildShortTime,
  buildContentHtml,
  htmlToMarkdown,
  CONTENT_BR_SPACER,
  ORIGINAL_LINK_HTML
};