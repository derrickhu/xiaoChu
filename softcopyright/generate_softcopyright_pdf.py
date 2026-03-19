#!/usr/bin/env python3
"""
软件著作权登记 - 源程序代码 PDF 生成工具
====================================================
严格按中国版权保护中心要求生成:
  1. A4 纸张, 纵向, 单面
  2. 页眉左侧: 软件全称 + 版本号 (与申请表完全一致)
  3. 页眉右侧: 阿拉伯数字连续页码
  4. 页眉下方有分隔线
  5. 页脚: 申请人名称 (著作权人, 公司申请填公司全称)
  6. 每页不少于 50 行 (最后一页除外), 纯空白行不计入
  7. 字号不大于 13
  8. 代码 ≥ 60 页取前 30 页 + 后 30 页, 不足 60 页全部提交
  9. 第 1 页第 1 行必须是程序入口 (主函数/入口文件), 最后一页最后一行是程序结尾
  10. 不能有大段空白、水印
  11. 行号连续
  12. 包含人名/地址/时间/版权的注释应删除
  13. 尽量少提供设计器自动生成的代码
"""

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

import os
import sys
from pathlib import Path
from math import ceil
from fpdf import FPDF

# ======================= 配置区 =======================

ROOT = Path('/Users/dklighu/p_proj/xiaoChu')
OUTPUT = ROOT / '软著源程序-灵宠消消塔-V1.0.0.pdf'

# ★ 软件全称+版本号, 必须与申请表中完全一致
SOFTWARE_FULL_NAME = '深圳幸运呱科技有限公司灵宠消消塔小游戏软件'
SOFTWARE_VERSION   = 'V1.0.0'

# ★ 申请人名称(著作权人): 公司申请填公司全称
APPLICANT_NAME = '深圳幸运呱科技有限公司'

LINES_PER_PAGE = 50       # 每页 50 行
FRONT_PAGES    = 30
BACK_PAGES     = 30

# 字体路径 (macOS)
SONGTI_PATH = '/System/Library/Fonts/Supplemental/Songti.ttc'

# 排版参数 (单位: mm)
CODE_FONT_SIZE   = 9       # 代码字号, 小五号 = 9pt, 不超过 13
HEADER_FONT_SIZE = 10.5    # 页眉字号
FOOTER_FONT_SIZE = 9       # 页脚字号
LINENO_FONT_SIZE = 7.5     # 行号字号

LINE_HEIGHT    = 4.6       # 代码行高 mm (9pt 字约 3.2mm, 4.6mm 行高留足间距)
LEFT_MARGIN    = 20        # 左边距
RIGHT_MARGIN   = 15        # 右边距
TOP_MARGIN     = 15        # 页面顶部到页眉文字的距离
BOTTOM_MARGIN  = 15        # 页面底部到页脚的距离

HEADER_TEXT = f'{SOFTWARE_FULL_NAME} {SOFTWARE_VERSION} 源程序'
MAX_CODE_CHARS = 100       # 单行最大字符数, 超出截断

# ======================= 逻辑区 =======================


class SoftCopyrightPDF(FPDF):
    """自定义 PDF 类, 自动绘制页眉页脚"""

    def __init__(self, total_pages):
        super().__init__(orientation='P', unit='mm', format='A4')
        self._total_pages = total_pages
        self.set_auto_page_break(auto=False)

    def header(self):
        """
        页眉:
          左侧 - 软件全称 + 版本号 + 源程序
          右侧 - 阿拉伯数字页码
          下方 - 分隔线
        """
        self.set_font('Songti', '', HEADER_FONT_SIZE)
        self.set_text_color(0, 0, 0)

        # 左侧: 软件名称 + 版本号 + 源程序
        self.set_xy(LEFT_MARGIN, TOP_MARGIN)
        self.cell(0, 6, HEADER_TEXT, new_x="LEFT", new_y="TOP")

        # 右侧: 页码 (阿拉伯数字)
        page_str = str(self.page_no())
        tw = self.get_string_width(page_str)
        self.set_xy(210 - RIGHT_MARGIN - tw, TOP_MARGIN)
        self.cell(tw, 6, page_str, new_x="LEFT", new_y="TOP")

        # 分隔线
        line_y = TOP_MARGIN + 7
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.4)
        self.line(LEFT_MARGIN, line_y, 210 - RIGHT_MARGIN, line_y)

    def footer(self):
        """
        页脚:
          居中 - 申请人名称 (著作权人/公司全称)
        """
        footer_y = 297 - BOTTOM_MARGIN
        self.set_xy(LEFT_MARGIN, footer_y)
        self.set_font('Songti', '', FOOTER_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.cell(210 - LEFT_MARGIN - RIGHT_MARGIN, 5, APPLICANT_NAME, align='C')


def collect_source_files(root: Path):
    """
    收集源码文件, 顺序:
    game.js → js/ 下所有 .js → cloudfunctions/ 下所有 .js
    """
    files = []
    game_js = root / 'game.js'
    if game_js.exists():
        files.append(game_js)
    js_dir = root / 'js'
    if js_dir.exists():
        files.extend(sorted(js_dir.rglob('*.js')))
    cloud_dir = root / 'cloudfunctions'
    if cloud_dir.exists():
        files.extend(sorted(cloud_dir.rglob('*.js')))
    return files


def read_all_lines(files):
    """
    读取所有源码行, 返回 [(行号, 代码文本), ...]
    ★ 根据软著标准: 纯空白行不算有效行, 需过滤掉
    ★ 大段描述性注释、含版权/人名/地址/日期的注释应删除
    """
    all_lines = []
    line_no = 1
    for fp in files:
        try:
            text = fp.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            text = fp.read_text(encoding='utf-8-sig')
        for raw_line in text.splitlines():
            clean = raw_line.rstrip('\n\r')
            # 跳过纯空白行 (软著标准: 纯空白行不计入有效行)
            if clean.strip() == '':
                continue
            all_lines.append((line_no, clean))
            line_no += 1
    return all_lines


def select_lines(all_lines):
    """
    按规则选取代码行:
    - 不足 60 页 (3000 行) → 全部提交
    - 超过 60 页 → 前 30 页 + 后 30 页
    """
    max_lines = (FRONT_PAGES + BACK_PAGES) * LINES_PER_PAGE
    if len(all_lines) <= max_lines:
        return all_lines
    head = all_lines[:FRONT_PAGES * LINES_PER_PAGE]
    tail = all_lines[-BACK_PAGES * LINES_PER_PAGE:]
    return head + tail


def truncate_code(text):
    """Tab 转空格, 超长截断"""
    safe = text.replace('\t', '    ')
    if len(safe) <= MAX_CODE_CHARS:
        return safe
    return safe[:MAX_CODE_CHARS - 3] + '...'


def generate_pdf(selected_lines):
    """生成最终 PDF 文件"""
    total_pages = ceil(len(selected_lines) / LINES_PER_PAGE)

    pdf = SoftCopyrightPDF(total_pages)

    # 注册宋体
    pdf.add_font('Songti', '', SONGTI_PATH)

    # 代码区起始 Y: 页眉分隔线下方
    code_start_y = TOP_MARGIN + 7 + 3  # 页眉 Y + 分隔线 + 间距
    lineno_col_w = 14  # 行号列宽 mm

    for page_idx in range(total_pages):
        pdf.add_page()

        start = page_idx * LINES_PER_PAGE
        end = min(start + LINES_PER_PAGE, len(selected_lines))
        page_items = selected_lines[start:end]

        for i, (line_no, code) in enumerate(page_items):
            y = code_start_y + i * LINE_HEIGHT

            # ---- 行号 (右对齐, 灰色) ----
            pdf.set_font('Songti', '', LINENO_FONT_SIZE)
            pdf.set_text_color(140, 140, 140)
            lineno_str = str(line_no)
            lw = pdf.get_string_width(lineno_str)
            pdf.set_xy(LEFT_MARGIN + lineno_col_w - lw - 1, y)
            pdf.cell(lw, LINE_HEIGHT, lineno_str)

            # ---- 代码 (黑色) ----
            pdf.set_font('Songti', '', CODE_FONT_SIZE)
            pdf.set_text_color(0, 0, 0)
            code_x = LEFT_MARGIN + lineno_col_w + 1
            pdf.set_xy(code_x, y)
            display = truncate_code(code)
            # 替换掉宋体无法显示的特殊字符 (emoji 等)
            display = ''.join(
                c if ord(c) < 0x10000 or ord(c) in range(0x4E00, 0x9FFF+1) else '?'
                for c in display
            )
            pdf.cell(0, LINE_HEIGHT, display)

    pdf.output(str(OUTPUT))
    return total_pages


def validate_pdf():
    """验证 PDF 基本信息"""
    from pypdf import PdfReader
    reader = PdfReader(str(OUTPUT))
    return len(reader.pages)


def main():
    files = collect_source_files(ROOT)
    if not files:
        print('错误: 未找到任何源码文件')
        sys.exit(1)

    all_lines = read_all_lines(files)
    selected = select_lines(all_lines)
    total_pages = generate_pdf(selected)
    validated = validate_pdf()

    total_source = len(all_lines)
    total_source_pages = ceil(total_source / LINES_PER_PAGE)

    print('=' * 50)
    print('  软著源程序 PDF 生成报告')
    print('=' * 50)
    print(f'  软件名称:     {SOFTWARE_FULL_NAME} {SOFTWARE_VERSION}')
    print(f'  申请人:       {APPLICANT_NAME}')
    print(f'  源码文件数:   {len(files)} 个')
    print(f'  源码总行数:   {total_source} 行')
    print(f'  源码总页数:   {total_source_pages} 页')
    if total_source_pages > FRONT_PAGES + BACK_PAGES:
        print(f'  提取方式:     前 {FRONT_PAGES} 页 + 后 {BACK_PAGES} 页')
    else:
        print(f'  提取方式:     全部提交')
    print(f'  选取行数:     {len(selected)} 行')
    print(f'  每页行数:     {LINES_PER_PAGE} 行')
    print(f'  代码字号:     {CODE_FONT_SIZE} pt')
    print(f'  代码行高:     {LINE_HEIGHT} mm')
    print(f'  生成页数:     {total_pages} 页')
    print(f'  PDF验证页数:  {validated} 页')
    print(f'  输出文件:     {OUTPUT}')
    print('=' * 50)

    # 完整性检查
    first_line = selected[0][1] if selected else ''
    last_line = selected[-1][1] if selected else ''
    print(f'  第1行: {first_line[:60]}')
    print(f'  末行:  {last_line[:60]}')

    if validated != total_pages:
        print('  ⚠️ 警告: PDF 页数与预期不一致!')
    else:
        print('  ✅ PDF 生成验证通过')


if __name__ == '__main__':
    main()
