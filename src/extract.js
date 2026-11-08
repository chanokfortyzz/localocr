// 从识别文本里抽结构化字段：目标是把一批扫描票据直接变成可核对的表格，
// 而不是让用户再去复制粘贴。启发式规则 + 全部字段可人工复核。
const PATTERNS = {
  invoiceNo: [
    /(?:发票号码|发票号|号码|票据号|单号|Invoice\s*(?:No\.?|Number)?)\s*[:：]?\s*([A-Z]{2,6}[-‐]?\d{4,}[-‐]?\d{0,})/i,
    /\b(INV[-‐]?\d{4,}[-‐]?\d*)\b/i,
  ],
  amount: [
    /(?:发票金额|金额|合计|总额|价税合计|Amount|Total)\s*[:：]?\s*(?:人民币|CNY|RMB|¥|\$)?\s*([\d,]+\.\d{2})/i,
    /(?:人民币|CNY|RMB|¥|\$)\s*([\d,]+\.\d{2})/i,
  ],
  taxRate: [
    /(?:税率|Tax\s*rate)\s*[:：]?\s*(\d{1,2}(?:\.\d+)?)\s*%/i,
  ],
  date: [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
    /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
    /([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/,
  ],
  party: [
    /(?:甲方|购买方|付款方|客户名称|Buyer|From)\s*[:：]\s*([^\n]{2,40})/,
    /([\u4e00-\u9fff]{2,20}(?:有限公司|股份有限公司|集团|事务所|工作室))/,
  ],
  issuer: [
    /(?:乙方|销售方|收款方|开票方|供应商|Seller|Vendor)\s*[:：]\s*([^\n]{2,40})/,
  ],
  currency: [/(人民币|CNY|RMB|USD|\$|EUR|HKD)/i],
};

function firstMatch(text, list) {
  for (const re of list) {
    const m = text.match(re);
    if (m) return m;
  }
  return null;
}

export function extractFields(text) {
  const clean = text.replace(/[ \t]+/g, ' ');

  const inv = firstMatch(clean, PATTERNS.invoiceNo);
  const amt = firstMatch(clean, PATTERNS.amount);
  const tax = firstMatch(clean, PATTERNS.taxRate);
  const dt = firstMatch(clean, PATTERNS.date);
  const party = firstMatch(clean, PATTERNS.party);
  const issuer = firstMatch(clean, PATTERNS.issuer);
  const cur = firstMatch(clean, PATTERNS.currency);

  let date = '';
  if (dt) {
    if (dt.length === 4) {
      date = `${dt[1]}-${String(dt[2]).padStart(2, '0')}-${String(dt[3]).padStart(2, '0')}`;
    } else {
      date = dt[1];
    }
  }

  const currencyRaw = cur ? cur[1] : '';
  const currency = /人民币|CNY|RMB/i.test(currencyRaw) ? 'CNY' : /USD|\$/i.test(currencyRaw) ? 'USD' : /EUR/i.test(currencyRaw) ? 'EUR' : /HKD/i.test(currencyRaw) ? 'HKD' : '';

  return {
    invoiceNo: inv ? inv[1] : '',
    amount: amt ? amt[1].replace(/,/g, '') : '',
    taxRate: tax ? `${tax[1]}%` : '',
    date,
    party: party ? party[1].trim() : '',
    issuer: issuer ? issuer[1].trim() : '',
    currency,
  };
}

const COLUMNS = [
  ['文件', (r) => r.file],
  ['页码', (r) => r.page],
  ['发票/单据号', (r) => r.invoiceNo],
  ['金额', (r) => r.amount],
  ['币种', (r) => r.currency],
  ['税率', (r) => r.taxRate],
  ['日期', (r) => r.date],
  ['对方名称', (r) => r.party],
  ['我方/开票方', (r) => r.issuer],
  ['识别字符数', (r) => r.chars],
];

export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLUMNS.map(([name]) => esc(name)).join(',');
  const body = rows.map((row) => COLUMNS.map(([, get]) => esc(get(row))).join(',')).join('\n');
  // BOM 让 Excel 正确识别 UTF-8 中文
  return `\ufeff${header}\n${body}`;
}
