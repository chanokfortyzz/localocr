#!/usr/bin/env python3
"""生成用于回归测试的模拟扫描件（中英混排，轻微旋转与噪点）。

用法: python3 scripts/make-test-doc.py /tmp/localocr-test.pdf
"""
import sys
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, JpegImagePlugin  # noqa: F401  (注册 JPEG 编码器，PIL 按需加载)

FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


PAGES = [
    [
        ("采购合同摘要", 46, 90),
        ("合同编号：HT-2026-0417", 26, 60),
        ("甲方：杭州云图科技有限公司", 26, 50),
        ("乙方：宁波精工零件有限公司", 26, 50),
        ("签署日期：2026 年 3 月 3 日", 26, 50),
        ("This Agreement is effective as of March 3, 2026.", 24, 70),
        ("Payment terms: 30 days net after invoice date.", 24, 44),
        ("Delivery location: Ningbo warehouse B2.", 24, 44),
    ],
    [
        ("结算明细 / Settlement Detail", 40, 90),
        ("发票号码：INV-2026-008812", 26, 60),
        ("发票金额：人民币 12,480.00 元", 26, 50),
        ("Total amount: CNY 12,480.00 (tax included)", 24, 50),
        ("税率：13%", 26, 50),
        ("Tax rate: 13 percent, VAT ordinary invoice.", 24, 50),
        ("备注：货物验收合格后付款。", 26, 60),
        ("Remarks: payment released after acceptance.", 24, 44),
    ],
]


def make_page(lines, width=1240, height=1754):
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    y = 140
    for text, size, gap in lines:
        draw.text((110, y), text, fill=(20, 20, 24), font=load_font(size))
        y += gap + size
    img = img.rotate(0.6, resample=Image.BICUBIC, fillcolor="white")
    noise = Image.effect_noise((width, height), 12).convert("L")
    img = Image.composite(img, Image.new("RGB", img.size, "white"), noise.point(lambda v: 255))
    return img.filter(ImageFilter.GaussianBlur(0.3))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/localocr-test.pdf"
    random.seed(7)
    pages = [make_page(p) for p in PAGES]
    pages[0].save(out, save_all=True, append_images=pages[1:], resolution=200)
    print(f"wrote {out} ({len(pages)} pages)")


if __name__ == "__main__":
    main()
