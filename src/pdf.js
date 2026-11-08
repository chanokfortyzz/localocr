import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data }).promise;
}

export async function renderPage(pdf, pageNumber, dpi) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // pdf.js 的渐进渲染依赖 requestAnimationFrame；浏览器切到后台标签页时 rAF 会被冻结，
  // 导致批量任务卡死。渲染期间用定时器替代，保证后台也能跑完。
  const origRaf = window.requestAnimationFrame;
  const origCancel = window.cancelAnimationFrame;
  const timers = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = window.setTimeout(() => cb(performance.now()), 0);
    timers.set(id, id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
    timers.delete(id);
  };
  try {
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  } finally {
    window.requestAnimationFrame = origRaf;
    window.cancelAnimationFrame = origCancel;
    for (const id of timers.keys()) clearTimeout(id);
  }
  page.cleanup();
  return canvas;
}

export async function mergePdfs(pagePdfs) {
  const out = await PDFDocument.create();
  for (const bytes of pagePdfs) {
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}
