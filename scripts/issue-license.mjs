#!/usr/bin/env node
// 发行解锁码（仅本机使用，不要提交私钥）。
// 用法: node scripts/issue-license.mjs <买家邮箱或标识> [有效天数]
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [, , buyer, days] = process.argv;
if (!buyer) {
  console.error('用法: node scripts/issue-license.mjs <买家邮箱或标识> [有效天数]');
  process.exit(1);
}

const keyPath = join(homedir(), '.localocr', 'license-private.pem');
const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));

const payload = {
  v: 1,
  id: randomUUID(),
  to: buyer,
  issued: Date.now(),
};
if (days) payload.exp = Date.now() + Number(days) * 86400000;

const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = sign('sha256', Buffer.from(payloadPart), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
}).toString('base64url');

console.log(`${payloadPart}.${sig}`);
