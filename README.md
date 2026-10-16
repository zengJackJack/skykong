# 星控科技官网

静态站点，托管于 GitHub Pages（域名见 `CNAME`）。

## 目录

| 路径 | 说明 |
|---|---|
| `index.html`、`sknest.html`、`slwcontrol.html`、`yxcut.html`、`drill6.html` | **生成产物**，不要直接改 |
| `_src/layout.html` | 公共骨架：页头、导航、联系我们、页脚、图标 |
| `_src/pages/*.html` | 各页正文（开头 `<!--meta ... -->` 写标题与描述） |
| `_src/build.py` | 把正文套进骨架，输出到根目录 |
| `_shots/*.html` | 产品界面示意图的源文件 |
| `_shots/render.py` | 用本机 Chrome 把示意图渲染为 2 倍清晰度 WebP，输出到 `assets/img/` |
| `assets/` | 样式、脚本、图片 |

以下划线开头的目录不会被 GitHub Pages 发布。

## 常用操作

```powershell
# 改完文案或骨架后重新生成页面
python _src/build.py

# 改完某张产品示意图后重新渲染（默认 1600×1000）
python _shots/render.py sknest-detail.html
python _shots/render.py slw-stats.html 1400 900
```

## 双语

中文写在元素内容里，英文写在同一元素的 `data-en` 属性中；图片替代文字用 `data-en-alt`。
页面右上角切换语言，选择会记在浏览器里。

## 文案原则

- 只讲客户能得到的效果，不写算法、引擎、通信协议、技术栈、第三方库等实现细节。
- 不出现竞品与客户的名称。
- 宣传数字须有内部实测依据。
