# LocalOCR

**批量 OCR，文件不离开你的电脑。** 把扫描件、照片、PDF 在浏览器里批量识别，导出可搜索 PDF、纯文本和结构化表格（CSV）。全程本地处理，文档不上传、不留副本。

## 为什么存在

在线 OCR 大多要你把文件传上去。合同、发票、人事档案这类东西，很多人根本不敢传。LocalOCR 用 WebAssembly 把识别引擎放进浏览器，理论上断网都能用（首次需要下载语言包）。

豆包这类对话式 AI 识别一张图更快，但它解决不了三件事：

- **批量**：一次几十上百页，逐页跑完不断线；
- **交付物**：要的是能归档的可搜索 PDF、能进系统的 CSV，不是聊天框里一段文字；
- **可复核**：每个字段落在表格里，错了能改。

## 功能

- 输入：JPG / PNG / WebP / PDF（多选、拖拽）
- 识别：中文、英文、中英混排
- 输出：可搜索 PDF（真文字层，可 Ctrl+F / 可复制）、TXT、CSV 字段表
- 字段抽取：发票号、金额、币种、税率、日期、甲乙方，启发式提取后人工可校
- 授权：离线签名校验（ECDSA P-256），不绑定账号

## 开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 产物在 dist/
```

生成测试用扫描件：

```bash
python3 scripts/make-test-doc.py /tmp/localocr-test.pdf
```

## 发行解锁码

私钥放在 `~/.localocr/license-private.pem`（不入库）。买家付款后：

```bash
node scripts/issue-license.mjs buyer@example.com        # 永久
node scripts/issue-license.mjs buyer@example.com 365    # 一年
```

把输出的字符串发给买家，在前端「解锁」框输入即可。

> 说明：纯前端授权可被有一定技术能力的人绕过。它的作用是让付费流程成立，不是 DRM。

## 技术栈

Vite · tesseract.js（WASM）· pdf.js · pdf-lib · Web Crypto

## 许可

商业软件，源码不授权再分发。识别引擎 tesseract.js 与 pdf.js 遵循各自的开源许可（Apache-2.0）。
