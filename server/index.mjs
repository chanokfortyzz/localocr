// LocalOCR 授权服务器：PayPal 收款 → 自动签发解锁码。
//
// 环境变量：
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET   真实收款必填
//   PAYPAL_ENV=live|sandbox                    默认 sandbox
//   PAYPAL_PRICE=19.00  PAYPAL_CURRENCY=USD    售价
//   PAYPAL_MOCK=1                              无凭据的本地联调模式
//   LICENSE_DAYS=0                             0=永久；>0=授权天数
//   PORT=8787                                  监听端口
//
// 私钥默认从 ~/.localocr/license-private.pem 读取，可用 LICENSE_KEY_PATH 覆盖。
import http from 'node:http';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const MOCK = process.env.PAYPAL_MOCK === '1';
const ENV = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const API_BASE = ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PRICE = process.env.PAYPAL_PRICE || '19.00';
const CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';
const LICENSE_DAYS = Number(process.env.LICENSE_DAYS || 0);
const DIST = process.env.DIST_DIR || join(process.cwd(), 'dist');

const keyPath = process.env.LICENSE_KEY_PATH || join(homedir(), '.localocr', 'license-private.pem');
if (!existsSync(keyPath)) {
  console.error(`缺少授权私钥: ${keyPath}`);
  process.exit(1);
}
const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));

function issueLicense(buyer) {
  const payload = { v: 1, id: randomUUID(), to: buyer || 'unknown', issued: Date.now() };
  if (LICENSE_DAYS > 0) payload.exp = Date.now() + LICENSE_DAYS * 86400000;
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign('sha256', Buffer.from(payloadPart), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${payloadPart}.${sig}`;
}

let cachedToken = null;
let tokenExp = 0;
async function paypalToken() {
  if (MOCK) return 'MOCK';
  if (cachedToken && Date.now() < tokenExp - 60000) return cachedToken;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('未配置 PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET');
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal 鉴权失败: ${res.status}`);
  const json = await res.json();
  cachedToken = json.access_token;
  tokenExp = Date.now() + (json.expires_in || 3000) * 1000;
  return cachedToken;
}

function send(res, status, body, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

async function handleApi(req, res, url) {
  // 1) 创建订单：前端点“获取解锁码”时调用
  if (url.pathname === '/api/orders' && req.method === 'POST') {
    if (MOCK) return send(res, 200, { mock: true, id: 'MOCK-ORDER-1', approveUrl: '/?order=MOCK-ORDER-1' });
    const token = await paypalToken();
    const r = await fetch(`${API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: CURRENCY, value: PRICE }, description: 'LocalOCR 买断授权' }],
        application_context: { brand_name: 'LocalOCR', user_action: 'PAY_NOW' },
      }),
    });
    const json = await r.json();
    if (!r.ok) return send(res, 502, { error: json });
    const approveUrl = json.links?.find((l) => l.rel === 'approve')?.href;
    return send(res, 200, { id: json.id, approveUrl });
  }

  // 2) 捕获订单并签发解锁码
  const capture = url.pathname.match(/^\/api\/orders\/([^/]+)\/capture$/);
  if (capture && req.method === 'POST') {
    const orderId = capture[1];
    if (MOCK) return send(res, 200, { code: issueLicense('mock-buyer'), orderId });
    const token = await paypalToken();
    const r = await fetch(`${API_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const json = await r.json();
    if (!r.ok) return send(res, 502, { error: json });
    if (json.status !== 'COMPLETED') return send(res, 402, { error: 'PAYPAL_NOT_COMPLETED', status: json.status });
    const payer = json.payer?.email_address || json.payer?.payer_id || 'unknown';
    return send(res, 200, { code: issueLicense(payer), orderId, payer });
  }

  if (url.pathname === '/api/health') return send(res, 200, { ok: true, mock: MOCK });
  return send(res, 404, { error: 'NOT_FOUND' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const filePath = normalize(join(DIST, p));
  if (!filePath.startsWith(normalize(DIST)) || !existsSync(filePath)) {
    const fallback = join(DIST, 'index.html');
    if (existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      createReadStream(fallback).pipe(res);
      return;
    }
    return send(res, 404, 'Not found', 'text/plain');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      await readBody(req).catch(() => '');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res, url);
    } catch (err) {
      console.error(err);
      return send(res, 500, { error: String(err.message || err) });
    }
  })
  .listen(PORT, () => {
    console.log(`LocalOCR license server on http://localhost:${PORT}  (mock=${MOCK}, env=${ENV})`);
  });
