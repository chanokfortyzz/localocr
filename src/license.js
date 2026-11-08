// 解锁码校验：ECDSA P-256 签名，公钥内置。私钥仅在发行方本机，无法被伪造。
const PUBLIC_KEY_SPKI_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElvaUTUjcCwrue6f5/2X4KnoXpTRc9unioc9upC/gTS8jsRAWc5qerEXKDrgXR8kjnLFisCMKm5+r5SrkVBvj2w==';

const QUOTA_KEY = 'localocr.pagesUsed';
const LICENSE_KEY = 'localocr.license';

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey = null;
async function publicKey() {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      'spki',
      b64urlToBytes(PUBLIC_KEY_SPKI_B64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  }
  return cachedKey;
}

export async function verifyLicenseCode(code) {
  const parts = String(code || '').trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;
  try {
    const key = await publicKey();
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      b64urlToBytes(sigPart),
      new TextEncoder().encode(payloadPart),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadPart)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getLicense() {
  try {
    return JSON.parse(localStorage.getItem(LICENSE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveLicense(payload) {
  localStorage.setItem(LICENSE_KEY, JSON.stringify(payload));
}

export function isUnlocked() {
  return Boolean(getLicense());
}

export function pagesUsed() {
  return Number(localStorage.getItem(QUOTA_KEY) || 0);
}

export function addPages(n) {
  const total = pagesUsed() + n;
  localStorage.setItem(QUOTA_KEY, String(total));
  return total;
}
