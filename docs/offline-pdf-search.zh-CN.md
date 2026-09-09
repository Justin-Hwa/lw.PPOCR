# 单 HTML 离线 PDF 检索

本 fork 基于 `lxw112190/lw.PPOCR.C`，保留其 C / WASM 推理引擎、PP-OCRv6 tiny 模型与许可证。新增功能在浏览器应用层实现。

## 使用

1. 用桌面 Chrome 或 Edge 打开 `offline-pdf-search.html`，等待内嵌模型初始化。
2. 选择一个 PDF（也支持图片），每行输入一个检索字符串。
3. 默认处理全部页面，点击“开始识别”。
4. 查看每个字符串的命中总数、所在页码、每页次数及每处置信度。未命中的字符串同样列出。
5. 点击某条命中结果，跳到对应页并突出显示命中的区域。
6. 修改字符串、大小写或空白选项即可重新检索已处理结果，不会再次运行 OCR。
7. “导出 JSON”包含全文、来源、坐标、逐页统计和全部检索结果。TXT 仍用于导出识别全文。

最终 HTML 包含 JS、WASM、模型、字典、PDF.js、中文 CMap、标准字体及图片解码器。运行时无需服务器、CDN 或首次联网下载；文件内容不上传。源码构建阶段需要下载并校验依赖，不能与使用阶段的离线能力混为一谈。

## 处理方式

| 模式 | 行为 |
| --- | --- |
| 自动（默认） | 读取文字层；没有可用文字、发现无效 Unicode，或页面包含位图时执行整页 OCR，并合并同位置的重复文字。 |
| 全页 OCR | 忽略文字层，适用于已有 OCR 层错误、字体映射异常或文字被转成轮廓的 PDF。 |
| 仅读取文字层 | 不执行 OCR；扫描图中的文字不在检查范围内。 |

文字和扫描图混排时默认两种来源合并。相同位置、归一化后内容一致的文字优先保留文字层。无法判定一致的识别差异不会被无条件丢弃；复杂版面仍需人工复核，可切换“全页 OCR”避免冲突来源。

## 匹配与置信度

- 按字面查找，不把输入当作正则表达式；不进行模糊匹配。
- 默认不区分英文字母大小写、忽略空白和换行，并使用 Unicode NFKC 统一全半角等兼容字符。
- 重复输入的等价字符串去重；重叠的匹配分别计数，例如 `aaaa` 中的 `aa` 为 3 处。
- 支持同页连续文字片段拼接；不跨页匹配，明显的横排列间空隙作为边界。
- OCR 显示引擎的 `rec_score`；跨多个来源片段时取相关 OCR 行的最低分。混合命中同时保留 `source: mixed`。
- 文字层不是 OCR，不存在识别模型分数，JSON 使用 `confidence: null`，界面显示“置信度不适用”。
- 分数是模型输出，不是经过校准的正确率保证。
- 高亮按原始来源粒度覆盖 PDF 文本片段或 OCR 行。当前引擎没有字符级坐标/分数，因此不伪造关键词字符级精确框；同一行的多次命中可能共享框。
- 标记显示在页面预览中；当前不生成带永久批注的 PDF 文件。

## 未完成与错误

停止操作在当前 OCR 页结束后生效。保留已处理页面，但其余页面明确显示“尚未检查”，不会将部分结果冒充全文未命中。后续页失败同样保留已完成部分并标记 `document.status: error`。更换文件立即清除旧结果。

## 快速打包（无需编译 C）

需要 Python 3.9+。在仓库根目录运行：

```bash
python web/repack_offline_search.py
```

生成 `dist/offline-pdf-search.html`，只需分发这个 HTML。不要把模板文件当作可运行产物。

快速路径固定使用上游 `v0.1.0-preview.7` 的浏览器 SDK，先验证整个发布 HTML 的 SHA-256，再抽出未修改的 SDK；PDF 适配、检索和界面来自本 fork 的当前源码。

上游发布 HTML SHA-256：

```text
c9e8e47f4d9f13606adfdef894a1fb7d8bb250d8646a7d621ce790bd6b4f00ce
```

首次构建会下载上游 HTML 和 `pdfjs-dist-6.3.289.tgz`；后者按仓库 `web/vendor/pdfjs/VERSION` 中的 SHA-256 严格验证。之后可以保留 `dist/release-cache/` 和 `dist/pdfjs-cache/` 在无网络的构建机复用。任一缓存校验不符会中止，绝不跳过校验。

## 从 C 源码构建

继续使用上游工具链和 `lw-ocr-html` 目标。激活 Emscripten、安装上游转换器依赖后：

```bash
emcmake cmake -S . -B build-wasm -G Ninja -DCMAKE_BUILD_TYPE=Release -DLW_BUILD_HTTP_DEMO=OFF -DBUILD_TESTING=OFF
cmake --build build-wasm --target lw-ocr-js lw-ocr-html
```

输出 `build-wasm/ocr-demo.html` 同样包含本 fork 的全部检索功能。CMake 追踪新增源码依赖，修改检索逻辑后会重新打包。

## 验证

无需安装浏览器的控制器/检索回归：

```bash
node --test web/test-pdf-search.cjs web/test-search-state.cjs
```

真实 PDF.js 集成测试需要 Node.js 22+ 和开发测试依赖 `@napi-rs/canvas`（只供测试，不进入 HTML），运行：

```bash
node web/test-pdf-text.cjs dist/offline-pdf-search.html
```

测试在内存构造英文、中文 CMap、旋转/CropBox 和扫描图页面，验证解析、离线字体资源请求、坐标转换和扫描页渲染。原有 `web/test_ocr_html.py` / `web/test_pdf_html.py` 浏览器测试继续保留，GitHub Actions 的 WASM 工作流也会执行新增纯 Node 回归。

本轮已通过 13 项检索/控制器测试和真实 PDF.js 集成测试；扫描页经 WASM 识别得到上游预期的 16 行，文本 SHA-256 与上游回归基线一致。尚未在本轮做真实浏览器点击、移动设备或用户业务 PDF 验收。

## 适用边界

推荐先用桌面浏览器。手机内存、超长 PDF、复杂多栏/竖排、错误的既有文字层、低分辨率扫描会影响速度、阅读顺序或召回率。本轮主要验证中英文横排；未承诺所有语言的识别精度。加密 PDF 的密码输入仍沿用上游“不支持”的界面行为。
