import { CHECKOUT_URL, FREE_PAGE_LIMIT, PRICE_DISPLAY } from './config.js';
import { openPdf, renderPage, mergePdfs } from './pdf.js';
import { ocrCanvas } from './ocr.js';
import { extractFields, toCsv } from './extract.js';
import * as lic from './license.js';

const $ = (sel) => document.querySelector(sel);
const dropzone = $('#dropzone');
const fileInput = $('#file-input');
const fileListEl = $('#file-list');
const runBtn = $('#run-btn');
const statusEl = $('#status');
const resultsEl = $('#results');
const quotaBadge = $('#quota-badge');

const state = {
  files: [],
  running: false,
  busy: false,
  nextId: 1,
};

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function refreshQuota() {
  if (lic.isUnlocked()) {
    quotaBadge.textContent = '已解锁 · 无限页';
    runBtn.textContent = '开始识别';
    return;
  }
  const left = Math.max(0, FREE_PAGE_LIMIT - lic.pagesUsed());
  quotaBadge.textContent = `免费额度：剩 ${left} 页`;
}

function renderFiles() {
  fileListEl.innerHTML = '';
  for (const entry of state.files) {
    const row = document.createElement('div');
    row.className = 'file-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.file.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = entry.pages ? `${entry.pages} 页 · ${humanSize(entry.file.size)}` : humanSize(entry.file.size);
    const st = document.createElement('span');
    st.className = `state ${entry.status || ''}`;
    st.textContent = entry.status === 'done' ? '完成' : entry.status === 'error' ? '失败' : entry.status === 'running' ? '处理中' : '';
    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.type = 'button';
    rm.textContent = '×';
    rm.title = '移除';
    rm.disabled = state.running;
    rm.addEventListener('click', () => {
      state.files = state.files.filter((f) => f !== entry);
      renderFiles();
      updateRunState();
    });
    row.append(name, meta, st, rm);
    fileListEl.append(row);
  }
}

function updateRunState() {
  runBtn.disabled = state.running || state.busy || state.files.length === 0;
}

async function addFiles(list) {
  const incoming = Array.from(list).filter((f) => /^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(f.type));
  if (!incoming.length) return;
  state.busy = true;
  updateRunState();
  for (const file of incoming) {
    const entry = { id: state.nextId++, file, pages: 0, status: '' };
    state.files.push(entry);
    renderFiles();
    if (file.type === 'application/pdf') {
      try {
        const pdf = await openPdf(file);
        entry.pages = pdf.numPages;
        pdf.destroy();
      } catch (err) {
        entry.status = 'error';
        console.error(err);
      }
    } else {
      entry.pages = 1;
    }
    renderFiles();
  }
  state.busy = false;
  updateRunState();
}

function setStatus(text, progress) {
  statusEl.hidden = false;
  statusEl.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = text;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('i');
  fill.style.width = `${Math.round((progress || 0) * 100)}%`;
  bar.append(fill);
  statusEl.append(label, bar);
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
}

function showResults(outputs) {
  if (window.__localocrTest) window.__localocrTest.lastOutputs = outputs;
  resultsEl.hidden = false;
  resultsEl.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = `识别完成 · 共 ${outputs.reduce((s, o) => s + o.pages.length, 0)} 页`;
  resultsEl.append(title);

  const allText = outputs.map((o) => o.pages.join('\n\n===== 分页 =====\n\n')).join('\n\n===== 文件分隔 =====\n\n');
  const allPdfs = outputs.flatMap((o) => o.pagePdfs.filter(Boolean));

  const dl = document.createElement('div');
  dl.className = 'dl';

  const txtBtn = document.createElement('button');
  txtBtn.type = 'button';
  txtBtn.textContent = '下载全部纯文本 (.txt)';
  txtBtn.addEventListener('click', () => download('localocr-text.txt', new Blob([allText], { type: 'text/plain;charset=utf-8' })));
  dl.append(txtBtn);

  if (allPdfs.length) {
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = '下载可搜索 PDF';
    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      pdfBtn.textContent = '正在合并…';
      try {
        const bytes = allPdfs.length === 1 ? allPdfs[0] : await mergePdfs(allPdfs);
        download('localocr-searchable.pdf', new Blob([bytes], { type: 'application/pdf' }));
      } finally {
        pdfBtn.disabled = false;
        pdfBtn.textContent = '下载可搜索 PDF';
      }
    });
    dl.append(pdfBtn);
  }

  for (const out of outputs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `仅 ${out.name} (.txt)`;
    b.addEventListener('click', () => download(`${baseName(out.name)}.txt`, new Blob([out.pages.join('\n\n')], { type: 'text/plain;charset=utf-8' })));
    dl.append(b);
  }

  resultsEl.append(dl);

  const pre = document.createElement('pre');
  pre.className = 'preview';
  pre.textContent = allText.slice(0, 6000) || '（没有识别到文字）';
  resultsEl.append(pre);

  appendTable(outputs);
}

function appendTable(outputs) {
  const rows = [];
  for (const out of outputs) {
    out.pages.forEach((pageText, idx) => {
      const f = extractFields(pageText);
      rows.push({ ...f, file: out.name, page: idx + 1, chars: pageText.length });
    });
  }
  if (!rows.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'table-block';
  const h = document.createElement('h3');
  h.textContent = '结构化字段（可导出表格，请人工核对）';
  wrap.append(h);

  const csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'csv-btn';
  csvBtn.textContent = '下载表格 (.csv，Excel 可直接打开)';
  csvBtn.addEventListener('click', () =>
    download('localocr-fields.csv', new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })),
  );
  wrap.append(csvBtn);

  const table = document.createElement('table');
  table.className = 'field-table';
  const cols = ['文件', '页码', '发票/单据号', '金额', '币种', '税率', '日期', '对方名称'];
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  cols.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    [r.file, r.page, r.invoiceNo, r.amount, r.currency, r.taxRate, r.date, r.party].forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v || '—';
      td.className = v ? '' : 'empty';
      tr.append(td);
    });
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  resultsEl.append(wrap);
}

function openUnlock(message) {
  const modal = $('#unlock-modal');
  if (message) $('#unlock-msg').textContent = message;
  modal.hidden = false;
}

async function run() {
  if (state.running || !state.files.length) return;

  const totalPages = state.files.reduce((s, f) => s + (f.pages || 1), 0);
  if (!lic.isUnlocked() && lic.pagesUsed() + totalPages > FREE_PAGE_LIMIT) {
    openUnlock(`这批文件共 ${totalPages} 页，免费额度只剩 ${Math.max(0, FREE_PAGE_LIMIT - lic.pagesUsed())} 页。看完导出结果后可以再解锁。`);
    return;
  }

  state.running = true;
  updateRunState();
  resultsEl.hidden = true;
  renderFiles();

  const lang = $('#lang').value;
  const dpi = Number($('#dpi').value);
  const outputs = [];
  let donePages = 0;

  try {
    for (const entry of state.files) {
      entry.status = 'running';
      renderFiles();
      const pages = [];
      const pagePdfs = [];
      try {
        if (entry.file.type === 'application/pdf') {
          const pdf = await openPdf(entry.file);
          for (let p = 1; p <= pdf.numPages; p += 1) {
            setStatus(`渲染 ${entry.file.name} 第 ${p}/${pdf.numPages} 页`, donePages / totalPages);
            const canvas = await renderPage(pdf, p, dpi);
            const res = await ocrCanvas(canvas, lang, (m) => {
              if (m.status === 'recognizing text') {
                setStatus(`识别 ${entry.file.name} 第 ${p}/${pdf.numPages} 页`, (donePages + m.progress) / totalPages);
              }
            });
            pages.push(res.text);
            pagePdfs.push(res.pdf);
            canvas.width = 0;
            canvas.height = 0;
            donePages += 1;
          }
          pdf.destroy();
        } else {
          const bitmap = await createImageBitmap(entry.file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          bitmap.close();
          const res = await ocrCanvas(canvas, lang, (m) => {
            if (m.status === 'recognizing text') {
              setStatus(`识别 ${entry.file.name}`, (donePages + m.progress) / totalPages);
            }
          });
          pages.push(res.text);
          pagePdfs.push(res.pdf);
          canvas.width = 0;
          canvas.height = 0;
          donePages += 1;
        }
        entry.status = 'done';
        outputs.push({ name: entry.file.name, pages, pagePdfs });
      } catch (err) {
        console.error(err);
        entry.status = 'error';
        if (window.__localocrTest) window.__localocrTest.lastError = String(err?.stack || err);
      }
      renderFiles();
    }

    setStatus('完成', 1);
    if (!lic.isUnlocked()) lic.addPages(totalPages);
    refreshQuota();
    showResults(outputs);
  } finally {
    state.running = false;
    updateRunState();
  }
}

// --- wiring ---

$('#pick-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => addFiles(fileInput.files));
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('over');
  }),
);
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});
runBtn.addEventListener('click', run);

$('#price-label').textContent = PRICE_DISPLAY;

$('#buy-btn').addEventListener('click', () => openUnlock(''));
$('#close-modal').addEventListener('click', () => {
  $('#unlock-modal').hidden = true;
});
$('#checkout-btn').addEventListener('click', () => {
  if (CHECKOUT_URL) {
    window.open(CHECKOUT_URL, '_blank', 'noopener');
  } else {
    $('#unlock-msg').textContent = '购买链接尚未配置（src/config.js 里的 CHECKOUT_URL）。';
  }
});
$('#unlock-btn').addEventListener('click', async () => {
  const code = $('#unlock-code').value;
  const payload = await lic.verifyLicenseCode(code);
  if (!payload) {
    $('#unlock-msg').textContent = '解锁码无效或已过期，请检查后重试。';
    return;
  }
  lic.saveLicense(payload);
  $('#unlock-modal').hidden = true;
  refreshQuota();
  updateRunState();
});

refreshQuota();
renderFiles();
updateRunState();

// 自动化回归钩子（浏览器测试用，不影响正常交互）
window.__localocrTest = {
  addFiles,
  run,
  state,
  outputs: () => document.querySelector('#results').innerText,
  setStatus,
};
