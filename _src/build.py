"""把 _src/pages/*.html 套进 _src/layout.html, 输出到站点根目录。

用法: python _src/build.py
页面文件开头是一段元信息注释:
    <!--meta
    title: 页面标题
    title_en: English title
    desc: 描述
    og: assets/img/xxx.webp
    -->
其余内容为 <main> 的正文。
"""
import pathlib
import re
import time

src = pathlib.Path(__file__).resolve().parent
root = src.parent
layout = (src / "layout.html").read_text(encoding="utf-8")
ver = time.strftime("%Y%m%d%H%M")

for page in sorted((src / "pages").glob("*.html")):
    text = page.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--meta\n(.*?)\n-->\n", text, re.S)
    if not m:
        raise SystemExit(f"{page.name}: 缺少 <!--meta --> 头")
    meta = dict(line.split(":", 1) for line in m.group(1).splitlines() if ":" in line)
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    html = layout
    for key, val in {
        "title": meta["title"],
        "title_en": meta.get("title_en", meta["title"]),
        "desc": meta.get("desc", ""),
        "og_image": meta.get("og", "assets/img/sknest-detail.webp"),
        "ver": ver,
        "body": text[m.end():].strip("\n"),
    }.items():
        html = html.replace("{{" + key + "}}", val)
    (root / page.name).write_text(html, encoding="utf-8", newline="\n")
    print("built", page.name)
