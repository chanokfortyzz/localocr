import { createWorker } from 'tesseract.js';

let worker = null;
let workerLang = null;

export async function getWorker(lang, onLog) {
  if (worker && workerLang === lang) return worker;
  if (worker) {
    await worker.terminate();
    worker = null;
    workerLang = null;
  }
  worker = await createWorker(lang, 1, {
    logger: (m) => onLog?.(m),
  });
  workerLang = lang;
  return worker;
}

// Tesseract 对中文按词切分时会在汉字间插入空格，导出前归一化。
export function normalizeText(raw) {
  return (raw || '')
    .replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/\s+([，。：；、！？）】」』%])/g, '$1')
    .replace(/([（【「『])\s+/g, '$1')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function ocrCanvas(canvas, lang, onLog) {
  const w = await getWorker(lang, onLog);
  const { data } = await w.recognize(canvas, {}, { text: true, pdf: true });
  return {
    text: normalizeText(data.text),
    pdf: data.pdf || null,
  };
}

export async function disposeWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerLang = null;
  }
}
