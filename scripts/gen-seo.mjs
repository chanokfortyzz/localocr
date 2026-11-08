// 生成静态 SEO 落地页、sitemap 与 robots。运行: node scripts/gen-seo.mjs <siteBaseUrl>
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] || 'https://chanokfortyzz.github.io/localocr').replace(/\/$/, '');
const PUB = join(process.cwd(), 'public');
if (!existsSync(PUB)) mkdirSync(PUB);

const CSS = `
:root{--bg:#0b0e14;--soft:#121722;--line:#202836;--text:#e6ebf2;--muted:#8b98ab;--accent:#4fd1a5}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#16202e,#0b0e14 60%);color:var(--text);font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:40px 22px 80px}a{color:var(--accent)}
.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:34px}
.brand{font-weight:700;letter-spacing:.2px}.brand b{color:var(--accent)}
h1{font-size:30px;line-height:1.3;letter-spacing:-.4px;margin:0 0 14px}h2{font-size:20px;margin:34px 0 10px}
p{color:#c3cfdd}ul,ol{color:#c3cfdd}li{margin:6px 0}
.cta{display:inline-block;margin:22px 0;padding:12px 22px;border-radius:10px;background:linear-gradient(140deg,var(--accent),#35a9d6);color:#05131a;font-weight:700;text-decoration:none}
.note{border-left:3px solid var(--accent);background:var(--soft);padding:12px 16px;border-radius:8px;color:var(--muted);font-size:14px}
footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:#5d6a7e;font-size:13px}
`;

const PAGES = [
  {
    slug: 'convert-scanned-pdf-searchable',
    title: '扫描件怎么变成可搜索 PDF？（离线批量方法）',
    desc: '扫描的 PDF 只能看不能搜怎么办？讲清 OCR 文字层原理，以及在不把文件上传到任何服务器的前提下批量转成可搜索 PDF。',
    h1: '扫描件怎么变成可搜索 PDF？',
    sections: [
      ['为什么扫描件搜不到字', '扫描件本质是一张张图片，里面没有文字信息。要让 Ctrl+F、复制、全文检索生效，需要 OCR 识别出文字，再把文字以“不可见文字层”叠加在图片上——这就是可搜索 PDF。'],
      ['常见的三种做法', '① 在线 OCR 网站：快，但文件要上传到别人服务器，合同、发票、病历通常不适合；② 桌面软件：功能强，但贵、装起来麻烦、批量操作常常要排队；③ 系统自带识别：macOS 实况文本、Windows PowerToys 能识别单张图，但没法把一整批 PDF 变成可搜索 PDF。'],
      ['不上传的做法：在浏览器里识别', '现代浏览器能直接跑 WebAssembly 版识别引擎。文件只在你的内存里被处理，不经过任何服务器，断网也能用。批量拖进几十上百页，逐页识别并合成一份可搜索 PDF。'],
      ['批量处理时要注意什么', '页面清晰度建议 200 DPI 以上；中文和英文混排要选对语言模型；处理长任务时不要以为切到别的标签页就一定会继续跑——要选那种后台也不中断的实现。'],
    ],
    faq: [
      ['可搜索 PDF 里的文字能编辑吗？', '不能直接编辑。它是在图片上叠加透明文字层，用于检索和复制；要改内容得回到源文件。'],
      ['识别准确率怎么样？', '清晰扫描件中英文都能到可用水平；倾斜、模糊、印章遮挡会影响准确率，重要文件建议抽查。'],
    ],
  },
  {
    slug: 'batch-invoice-ocr-to-excel',
    title: '批量发票识别导出 Excel：不上传、可复核的做法',
    desc: '一叠扫描发票怎么快速变成能核对的表格？讲清批量 OCR + 字段抽取的思路、常见坑，以及如何避免把发票原件上传到第三方。',
    h1: '批量发票识别导出 Excel',
    sections: [
      ['代账和小团队的共同痛点', '月底几十上百张发票要录进表格，手打又慢又容易错。用对话式 AI 一张张问，页数一多就不现实，而且发票要上传到对话平台。'],
      ['批量 + 结构化才是关键', '真正省时间的不是“能识别”，而是“能批量”且“直接出表”：发票号、金额、税率、日期、甲乙方这些字段要落成一行行数据，能导出 CSV/Excel 再人工核对。'],
      ['启发式抽取 + 人工复核', '字段抽取是启发式规则，不是 100% 准确。正确用法是：批量跑完 → 导出表格 → 快速扫一遍异常值（金额为空、税率缺失）→ 修正。比手打快一个数量级，且原件不出本机。'],
      ['保密与合规', '发票含税号、金额、往来单位等敏感信息。把它们上传到任意第三方服务都要评估风险；本地识别把这一层风险直接去掉。'],
    ],
    faq: [
      ['能识别增值税专用发票的全部字段吗？', '常见字段（号码、金额、税额、税率、日期、购销方）可以抽取，冷僻字段需要按模板补充规则。'],
      ['导出的表格能直接进财务系统吗？', '导出为 CSV 后可再映射到你的系统字段；建议先小批量核对格式。'],
    ],
  },
  {
    slug: 'why-not-upload-confidential-documents',
    title: '为什么别把合同、病历、人事档案上传到在线 OCR',
    desc: '在线 OCR 上传的不只是文件，还有合规责任。讲清上传型工具的风险，以及如何在本地完成识别与归档。',
    h1: '为什么别把敏感文件上传到在线 OCR',
    sections: [
      ['上传意味着什么', '上传即把文件副本交给第三方服务器，通常还包含保留期限、日志、可能的人工审核与跨境传输。对合同、病历、员工档案，这不是“方不方便”的问题，而是责任问题。'],
      ['真正需要的是“不出本机”', '识别这件事本身不需要联网。把基于 WebAssembly 的识别引擎放进浏览器，文档只在本地内存处理，语言包下载后可离线运行——风险面大幅缩小。'],
      ['落地建议', '能本地做的一律本地做；必须用云服务的，先脱敏再上传；把“是否上传”写进你的数据处理说明里，客户问起来拿得出手。'],
    ],
    faq: [
      ['浏览器本地识别真的不上传吗？', '取决于实现。要选明确说明“文件不上传、只下载语言包”的工具，且可以断网验证。'],
      ['本地识别会更慢吗？', '首次要下载语言包会慢一点，之后靠本机 CPU 跑，批量时总体比“上传—排队—下载”更可控。'],
    ],
  },
];

function render(page) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${page.title} · LocalOCR</title>
<meta name="description" content="${page.desc}"/>
<link rel="canonical" href="${BASE}/${page.slug}.html"/>
<meta property="og:title" content="${page.title}"/><meta property="og:description" content="${page.desc}"/>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<style>${CSS}</style></head><body><div class="wrap">
<div class="top"><span class="brand"><b>Local</b>OCR</span><a href="/">打开工具 →</a></div>
<h1>${page.h1}</h1>
${page.sections.map(([h, p]) => `<h2>${h}</h2><p>${p}</p>`).join('\n')}
<a class="cta" href="/">现在试试 · 文件不上传的批量 OCR</a>
<div class="note">LocalOCR 在你的浏览器里完成识别：文档不上传，可搜索 PDF 与 CSV 表格直接导出，中文英文混排可用。</div>
<h2>常见问题</h2>
${page.faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('\n')}
<footer>LocalOCR · 本地批量 OCR · <a href="/">首页</a> · <a href="/privacy.html">隐私说明</a></footer>
</div></body></html>`;
}

for (const p of PAGES) writeFileSync(join(PUB, `${p.slug}.html`), render(p));

const privacy = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>隐私说明 · LocalOCR</title>
<meta name="description" content="LocalOCR 隐私说明：文档不上传，识别在本机浏览器完成。"/>
<style>${CSS}</style></head><body><div class="wrap">
<div class="top"><span class="brand"><b>Local</b>OCR</span><a href="/">打开工具 →</a></div>
<h1>隐私说明</h1>
<h2>我们不收集你的文档</h2><p>你选择的文件只在你的浏览器内存中被读取和处理，不会上传到任何服务器。识别引擎基于 WebAssembly 在本机运行。</p>
<h2>会联网的部分</h2><p>首次使用时会从 CDN 下载识别引擎与语言包；之后缓存到本地，可离线使用。除购买授权外，我们不发送你的文件内容。</p>
<h2>本机保存的数据</h2><p>免费页数计数与解锁状态保存在浏览器 localStorage，你可以随时清除站点数据清除它们。</p>
<h2>购买</h2><p>购买流程由 PayPal 处理支付，我们不会接触你的支付凭证。</p>
<footer>LocalOCR · <a href="/">首页</a></footer></div></body></html>`;
writeFileSync(join(PUB, 'privacy.html'), privacy);

const urls = ['/', ...PAGES.map((p) => `/${p.slug}.html`), '/privacy.html'];
writeFileSync(
  join(PUB, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${BASE}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`generated ${PAGES.length} SEO pages + privacy + sitemap for ${BASE}`);
