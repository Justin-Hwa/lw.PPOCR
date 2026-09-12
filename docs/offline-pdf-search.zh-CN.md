# 单 HTML 离线 PDF 检索

本 fork 基于 `lxw112190/lw.PPOCR.C`，保留其 C / WASM 推理引擎、PP-OCRv6 tiny 模型与许可证。新增功能在浏览器应用层实现。

## 使用

1. 用桌面 Chrome 或 Edge 打开 `offline-pdf-search.html`，等待内嵌模型初始化。
2. 选择一个 PDF（也支持图片），每行输入一个检索字符串。
3. 在“识别模型”中选择 PP-OCRv6、PP-OCRv5 Thai 或 Tesseract。泰语扫描件可分别尝试后两种模型；默认处理全部页面，点击“开始识别”。
4. 查看每个字符串的命中总数、所在页码、每页次数及每处置信度。未命中的字符串同样列出。
5. 点击某条命中结果，跳到对应页并突出显示命中的区域。
6. 修改字符串、大小写或空白选项即可重新检索已处理结果，不会再次运行 OCR。
7. “导出 JSON”包含全文、来源、坐标、逐页统计和全部检索结果。TXT 仍用于导出识别全文。

最终 HTML 包含 JS、WASM、模型、字典、PDF.js、中文 CMap、标准字体及图片解码器。运行时无需服务器、CDN 或首次联网下载；文件内容不上传。源码构建阶段需要下载并校验依赖，不能与使用阶段的离线能力混为一谈。

## 界面与预览

- Header 右上角可切换中文、日文、英文、泰文，以及浅色／深色主题。偏好保存在当前浏览器；浏览器限制本地存储时，本次会话内仍可切换。
- 语言菜单仅显示中国、日本、英国、泰国国旗图标，悬停或使用屏幕阅读器可获取语言名称。国旗为内嵌 SVG，不依赖系统 emoji 字体或联网。主题按钮用月亮表示切换深色、太阳表示切换浅色；提示随界面语言更新。
- 语言切换覆盖按钮、设置、状态、检索统计与置信度说明；不会翻译文件内容、修改查询或重新执行 OCR。界面语言不改变内嵌 OCR 模型的语言能力。TXT 导出的 `Page` 分页分隔符和 JSON 字段保持兼容。
- 文件设置、检索设置、PDF 选项、状态、检索结果、预览与识别结果都可通过区域标题展开／收缩。已折叠的查询项在进度刷新或语言切换后保持折叠。
- 预览支持 25%–400% 缩放；100% 表示适合当前视口宽度。超过视口时可横向、纵向滚动；“适合宽度”恢复 100%。缩放不改变识别坐标或重新运行 OCR。
- 在预览内容上按住鼠标左键或触控笔拖动，即可平移可见区域；页面内和全屏弹窗均支持。松开、取消操作或窗口失焦时结束拖动。触摸屏保留浏览器原生手指滚动，滚轮与滚动条也可继续使用。
- “全屏预览”打开占满浏览器视口的模态弹窗，使用同一画布、标注和当前页，可继续缩放、翻页与显隐标注。点击关闭或按 Esc 返回原卡片。弹窗不需要浏览器全屏权限或额外窗口。
- 识别结果与预览在桌面使用相同的卡片高度，结果区域滚动到底部；手机保留图片／结果切换。
- 动画进度条按本次选定范围内已完成的页面数计量；图片计为 1 页。完成、停止、失败时均保留实际进度，选择新文件时清空。开启系统“减少动态效果”后停用动画。

## 自动校正 PDF 方向

- 选择 PDF 后只渲染原始预览，显示“方向待识别”；翻页、缩放、全屏、切换扫描语言和重置方向均不执行推理。**只有点击“开始识别”后**，才按当前页／全部页面范围依次判断方向、刷新转正预览，再进行文字提取／OCR 与检索。
- 方向判断支持 0°／90°／180°／270°。可靠文字层优先使用基线方向；扫描页使用当前扫描语言的内嵌 OCR 对四个方向探测。泰语引擎结果不确定或执行失败时，自动尝试 PP-OCR（可利用扫描件的英文、数字等内容）；备用引擎不会改变正式泰语 OCR 所用模型。
- 方向识别纳入本次识别进度，可通过“停止”取消后续探测；不缓存中途取消的结果。转正后立即刷新预览，无需等待正式文字 OCR 完成。无法判断和引擎失败分开提示，均保留原方向；下次点击识别会重试。
- 校正角度按文档逐页缓存；翻页、放大和全屏只复用已知方向，未识别页保持原始预览。转正由 PDF.js 重新渲染，JSON 中的 PDF 坐标仍映射到原始页面。
- 切换“扫描识别语言”或“阅读顺序”会清除整份文档的方向缓存、旧识别结果和标注，保留检索字符串，等待下次点击“开始识别”。“重置方向”仅重置当前页方向并清除旧结果，同样不会启动推理。
- 阅读顺序控制文字排序，不再阻止整页方向判断；文字层自身标明竖排时保留原有排版。方向判断独立于检索字符串，不使用关键词决定角度。
- “复制方向诊断”提供构建标识、浏览器、引擎后端、当前页、画布尺寸及候选分数／错误类别；不包含文件名、路径、文档内容或查询词。JSON 的 `pages[].pdf.orientation` 同样记录校正角度、方法、引擎尝试及耗时；margin 是候选差距，不是 OCR 置信度。
- 方向探测独立于正式识别模式；即使选择“仅读取文字层”，点击识别后仍可为预览运行临时方向 OCR，其输出不会写入全文或检索结果。此功能处理直角旋转，不包含小角度倾斜矫正。

## 识别模型与泰语 PDF

| 页面选项 | 文字识别器 | 适用语言 |
| --- | --- | --- |
| PP-OCRv6 | 原有 PP-OCRv6 tiny C / WASM | 中文、日文、英文 |
| PP-OCRv5 Thai | 官方 `th_PP-OCRv5_mobile_rec`，ONNX Runtime Web 1.22.0 | 泰语、英语 |
| Tesseract | Tesseract.js 7.0.0 + tessdata_fast | 泰语、英语 |

- 保留原有两种引擎，默认仍为 PP-OCRv6。界面语言与识别模型独立；切换模型会清除旧结果与方向缓存，不自动开始推理。只有点击“开始识别”才加载新模型、探测方向和识别。
- PP-OCRv5 Thai 是官方泰语**识别器**，复用现有 PP-OCRv6 的检测框，不是完整 PP-OCRv5 检测流水线。现有 SDK 没有公开的仅检测接口，因此会先运行原有流水线取得框，丢弃旧文字及识别分数，再对原始图像透视裁剪，用 Thai 模型重识别。保留检测分数，文字和行级置信度均来自 Thai 模型。
- Thai 预处理采用 BGR、48 像素高、动态宽度（320–3200）、CHW 和 [-1, 1] 归一化；CTC 字典附加空格，解码保留泰文组合附标。输出分数是有效 CTC 字符概率的均值，不等同于业务正确率。Tesseract 分数仍按其行级分数换算为 0–1；不同模型的分数未经跨模型校准。
- 两种泰语模式使用横排读取，禁用原有 PP-OCR 的行分类／阅读顺序控件；切回 PP-OCRv6 恢复设置。整页方向仍独立探测，必要时使用 PP-OCR 作为备用方向引擎；正式识别失败时不会偷偷改用其他模型。
- 有有效文字层的 PDF 仍优先提取原文，置信度为 null；扫描页或“全页 OCR”使用所选引擎。JSON 保留 `ocr_language`，OCR 行的 `ocr_engine` 分别为 `ppocrv5-thai` 或 `tesseract-tha-eng`。
- 所有模型、字典、WASM 和运行时代码均内嵌，HTML 约 57 MB。直接打开 `file://` 并断网可用，无需首次联网。PP-OCRv5 Thai 使用单线程 WASM SIMD 和后台 Worker，适用于现代桌面 Chrome / Edge；旧浏览器仍可选 Tesseract 标量内核。
- 归一化匹配兼容泰语 `ำ` 与 `ํา` 两种 Unicode 表示，保留声调；不会忽略不同声调或自动修正 OCR 拼写。复杂小字号表格、相近字和特殊符号仍需复核；提高 DPI 或切换模型可用于对照，不保证手写识别。

### 官方资源与可复现构建

模型来源：[PaddlePaddle/th_PP-OCRv5_mobile_rec](https://huggingface.co/PaddlePaddle/th_PP-OCRv5_mobile_rec)，固定版本 `9e25080455925d3943f5db885fddc79db6a07ca3`，Apache-2.0。

`web/prepare_ppocrv5_thai.py` 校验官方下载文件，用独立 Python 3.12 虚拟环境内的 PaddlePaddle 3.0.0 / Paddle2ONNX 2.0.1 转为 opset 14 ONNX，不使用可选优化器。输出 SHA-256 为 `b5271c801ca144b4728c326eb601c847a4707d938f8e741d921c465bf284e680`。首次构建会下载约 193 MB 的 Paddle 构建依赖；后续复用经过校验的 `ppocrv5-thai-cache/thai.onnx`。Paddle 和 Python 不需要安装在 HTML 使用者的机器上。

运行快速打包前安装 `requirements-wasm-test.txt`（包含 PyYAML）。CMake 和快速打包均内嵌同一资源；HTML 中包含模型 Apache 许可证、ONNX Runtime MIT 许可证及第三方声明。

## 处理方式

| 模式 | 行为 |
| --- | --- |
| 自动（默认） | 读取文字层；没有可用文字、发现无效 Unicode，或页面包含位图时执行整页 OCR，并合并同位置的重复文字。 |
| 全页 OCR | 忽略文字层，适用于已有 OCR 层错误、字体映射异常或文字被转成轮廓的 PDF。 |
| 仅读取文字层 | 只提取文字层作为检索结果；扫描图中的文字不在检索范围内，预览方向探测独立运行。 |

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

首次构建会下载上游 HTML 和 `pdfjs-dist-6.3.289.tgz`；后者按仓库 `web/vendor/pdfjs/VERSION` 中的 SHA-256 严格验证。之后可以保留 `dist/release-cache/` 、`dist/pdfjs-cache/` 和 `dist/thai-cache/` 在无网络的构建机复用。任一缓存校验不符会中止，绝不跳过校验。泰语依赖的固定版本、模型提交与校验和记录在 `web/prepare_thai_resources.py`，构建时一并下载并校验。

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
node --test web/test-pdf-search.cjs web/test-search-state.cjs web/test-thai-ocr.cjs web/test-pdf-orientation.cjs
```

真实 PDF.js 集成测试需要 Node.js 22+ 和开发测试依赖 `@napi-rs/canvas`（只供测试，不进入 HTML），运行：

```bash
node web/test-pdf-text.cjs dist/offline-pdf-search.html
```

测试在内存构造英文、中文 CMap、旋转/CropBox 和扫描图页面，验证解析、离线字体资源请求、坐标转换和扫描页渲染。原有 `web/test_ocr_html.py` / `web/test_pdf_html.py` 浏览器测试继续保留，GitHub Actions 的 WASM 工作流也会执行新增纯 Node 回归。

Node 回归覆盖检索、部分结果、四种语言与主题偏好、弹窗还原、翻页、缩放边界和进度状态。浏览器回归还检查卡片折叠、结果区域底部对齐、弹窗中的标注与画布尺寸，以及 Esc 关闭。运行浏览器回归需要先安装 `requirements-wasm-test.txt` 和 Playwright Chromium：

```bash
python web/test_ocr_html.py --html dist/offline-pdf-search.html --sample models/ppocrv6-tiny/sample.jpg
python web/test_pdf_html.py --html dist/offline-pdf-search.html --sample models/ppocrv6-tiny/sample.jpg
python web/test_thai_html.py --html dist/offline-pdf-search.html
python web/test_pdf_orientation.py --html dist/offline-pdf-search.html
```

泰语浏览器测试从第一次打开页面就禁用网络，使用仓库内的合成泰文样本验证文字层、两页扫描件、SIMD／标量内核、英泰混排、重复命中、声调／附标、行级分数、点击定位、全屏缩放和引擎复用。不会为提高通过率修改识别结果。

## 适用边界

推荐先用桌面浏览器。手机内存、超长 PDF、复杂多栏/竖排、错误的既有文字层、低分辨率扫描会影响速度、阅读顺序或召回率。已验证中英文及泰文横排样本；不承诺任意文档的识别精度。加密 PDF 的密码输入仍沿用上游“不支持”的界面行为。
