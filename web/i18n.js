/* UI translations only: never translate document text, filenames or search strings. */
(function (root) {
  "use strict";
  const languages = ["zh-CN", "en", "ja", "th"];
  const messages = {
  "正在校正第 {0} 页方向…": ["正在自动校正第 {0} 页方向…", "Checking orientation of page {0}…", "{0} ページの向きを自動補正中…", "กำลังปรับทิศทางหน้า {0} อัตโนมัติ…"],
  " · 已自动顺时针旋转 {0}°": [" · 已自动顺时针旋转 {0}°", " · Auto-rotated {0}° clockwise", " · 時計回りに {0}° 自動回転", " · หมุนตามเข็มนาฬิกา {0}° อัตโนมัติ"],
  " · 方向无法确定，保留原方向": [" · 方向无法确定，保留原方向", " · Orientation uncertain; original kept", " · 向きを判定できないため元の向きを維持", " · ระบุทิศทางไม่ได้ ใช้ทิศทางเดิม"],
  "扫描识别语言": ["扫描识别语言", "OCR language", "スキャン認識言語", "ภาษาสำหรับ OCR"],
  "原有模型（中文／日文／英文）": ["原有模型（中文／日文／英文）", "Original model (Chinese / Japanese / English)", "従来モデル（中国語／日本語／英語）", "โมเดลเดิม (จีน / ญี่ปุ่น / อังกฤษ)"],
  "泰语＋英语": ["泰语＋英语", "Thai + English", "タイ語＋英語", "ไทย + อังกฤษ"],
  "泰语识别提示": ["泰语扫描件请选择“泰语＋英语”。此设置独立于界面语言；仅影响图片 OCR。", "For Thai scans, select Thai + English. This is independent of the interface language and affects image OCR only.", "タイ語のスキャンは「タイ語＋英語」を選択してください。表示言語とは独立した設定で、画像の OCR に適用されます。", "สำหรับเอกสารสแกนภาษาไทย ให้เลือก ไทย + อังกฤษ การตั้งค่านี้แยกจากภาษาของหน้าจอ และมีผลกับ OCR รูปภาพเท่านั้น"],
  "正在加载泰语引擎…": ["正在加载泰语离线引擎…", "Loading offline Thai OCR…", "タイ語オフラインエンジンを読み込み中…", "กำลังโหลดเอนจิน OCR ภาษาไทยแบบออฟไลน์…"],
  "泰语引擎待命": ["泰语＋英语 OCR · 首次识别时加载内嵌模型 · 横排识别", "Thai + English OCR · Embedded model loads on first use · Horizontal text", "タイ語＋英語 OCR · 初回認識時に内蔵モデルを読み込み · 横書き", "OCR ไทย + อังกฤษ · โหลดโมเดลที่ฝังไว้เมื่อใช้ครั้งแรก · ข้อความแนวนอน"],
  "页码": ["第 {0} / {1} 页", "Page {0} / {1}", "{0} / {1} ページ", "หน้า {0} / {1}"],
  "关": ["关闭", "Off", "オフ", "ปิด"],
  " · OCR 分数来自模型，不能视为正确率保证。": [
    " · OCR 分数来自模型，不能视为正确率保证。",
    " · OCR scores are model estimates, not accuracy guarantees.",
    " · OCR スコアはモデルの推定値であり、正確性を保証しません。",
    " · คะแนน OCR เป็นค่าประเมินจากโมเดล ไม่รับประกันความถูกต้อง"
  ],
  " · PDF 兼容模式": [
    " · PDF 兼容模式",
    " · PDF compatibility mode",
    " · PDF 互換モード",
    " · โหมดความเข้ากันได้ของ PDF"
  ],
  " · 仅检索文字层，未检查扫描图": [
    " · 仅检索文字层，未检查扫描图",
    " · Text layer only; scanned images not checked",
    " · テキスト層のみ、スキャン画像は未確認",
    " · ค้นหาเฉพาะชั้นข้อความ ยังไม่ได้ตรวจภาพสแกน"
  ],
  " · 第 ": [
    " · 第 ",
    " · Match ",
    " · 一致 ",
    " · จุดที่ "
  ],
  " 处 · ": [
    " 处 · ",
    " · ",
    " · ",
    " ·"
  ],
  "OCR 分数不可用": [
    "OCR 分数不可用",
    "OCR score unavailable",
    "OCR スコアなし",
    "ไม่มีคะแนน OCR"
  ],
  "OCR 实例正忙，请等待当前识别完成": [
    "OCR 实例正忙，请等待当前识别完成",
    "OCR is busy. Wait for recognition to finish.",
    "OCR は使用中です。認識の完了をお待ちください。",
    "OCR กำลังทำงาน โปรดรอจนการรู้จำเสร็จ"
  ],
  "OCR 引擎初始化失败": [
    "OCR 引擎初始化失败",
    "OCR engine initialization failed",
    "OCR エンジン初期化失敗",
    "เริ่มต้นเอนจิน OCR ไม่สำเร็จ"
  ],
  "OCR 行级置信度 ": [
    "OCR 行级置信度 ",
    "OCR line confidence ",
    "OCR 行の信頼度 ",
    "ความเชื่อมั่นบรรทัด OCR "
  ],
  "OCR 行级识别 ": [
    "OCR 行级识别 ",
    "OCR line confidence ",
    "OCR 行の信頼度 ",
    "ความเชื่อมั่นบรรทัด OCR "
  ],
  "PDF 密码错误。": [
    "PDF 密码错误。",
    "Incorrect PDF password.",
    "PDF のパスワードが違います。",
    "รหัสผ่าน PDF ไม่ถูกต้อง"
  ],
  "PDF 已准备好": [
    "PDF 已准备好",
    "PDF ready",
    "PDF の準備完了",
    "PDF พร้อมแล้ว"
  ],
  "PDF 已准备好，点击“开始识别”执行 OCR。": [
    "PDF 已准备好，点击“开始识别”执行 OCR。",
    "PDF ready. Click “Start recognition”.",
    "PDF の準備完了。「認識開始」をクリックしてください。",
    "PDF พร้อมแล้ว คลิก “เริ่มรู้จำ”"
  ],
  "PDF 已打开，但首页渲染失败；浏览器兼容性或可用内存可能不足。": [
    "PDF 已打开，但首页渲染失败；浏览器兼容性或可用内存可能不足。",
    "PDF opened, but rendering failed. Browser support or available memory may be insufficient.",
    "PDF は開けましたが描画に失敗しました。ブラウザーの互換性やメモリ不足の可能性があります。",
    "เปิด PDF ได้แต่แสดงหน้าไม่สำเร็จ เบราว์เซอร์อาจไม่รองรับหรือหน่วยความจำไม่พอ"
  ],
  "PDF 打开失败 · 查看诊断信息": [
    "PDF 打开失败 · 查看诊断信息",
    "PDF could not open · View diagnostics",
    "PDF を開けませんでした · 診断情報",
    "เปิด PDF ไม่สำเร็จ · ดูข้อมูลวินิจฉัย"
  ],
  "PDF 打开失败，请查看诊断信息。": [
    "PDF 打开失败，请查看诊断信息。",
    "Cannot open PDF. See diagnostics.",
    "PDF を開けません。診断情報を確認してください。",
    "เปิด PDF ไม่สำเร็จ โปรดดูข้อมูลวินิจฉัย"
  ],
  "PDF 文件读取已取消。": [
    "PDF 文件读取已取消。",
    "PDF reading cancelled.",
    "PDF の読み込みをキャンセルしました。",
    "ยกเลิกการอ่าน PDF แล้ว"
  ],
  "PDF 文字层 · 置信度不适用": [
    "PDF 文字层 · 置信度不适用",
    "PDF text layer · Confidence not applicable",
    "PDF テキスト層 · 信頼度は対象外",
    "ชั้นข้อความ PDF · ไม่ใช้ค่าความเชื่อมั่น"
  ],
  "PDF 清晰度": [
    "PDF 清晰度",
    "PDF resolution",
    "PDF 解像度",
    "ความละเอียด PDF"
  ],
  "PDF 解析失败：文件可能损坏，或当前浏览器不支持该 PDF。": [
    "PDF 解析失败：文件可能损坏，或当前浏览器不支持该 PDF。",
    "PDF parsing failed: the file may be damaged or unsupported.",
    "PDF の解析に失敗しました。ファイルが破損しているか未対応の形式です。",
    "แยกวิเคราะห์ PDF ไม่สำเร็จ ไฟล์อาจเสียหายหรือไม่รองรับ"
  ],
  "PDF 识别失败：": [
    "PDF 识别失败：",
    "PDF recognition failed: ",
    "PDF 認識失敗：",
    "รู้จำ PDF ไม่สำเร็จ: "
  ],
  "PDF 识别选项": [
    "PDF 识别选项",
    "PDF recognition options",
    "PDF 認識オプション",
    "ตัวเลือกการรู้จำ PDF"
  ],
  "PDF 诊断信息已复制。": [
    "PDF 诊断信息已复制。",
    "PDF diagnostics copied.",
    "PDF 診断情報をコピーしました。",
    "คัดลอกข้อมูลวินิจฉัย PDF แล้ว"
  ],
  "PDF 页面": [
    "PDF 页面",
    "PDF pages",
    "PDF ページ",
    "หน้า PDF"
  ],
  "PDF 页面预览": [
    "PDF 页面预览",
    "PDF page preview",
    "PDF ページプレビュー",
    "ตัวอย่างหน้า PDF"
  ],
  "WASM 初始化失败：": [
    "WASM 初始化失败：",
    "WASM initialization failed: ",
    "WASM 初期化失敗：",
    "เริ่มต้น WASM ไม่สำเร็จ: "
  ],
  "recognize() 仅接受图片": [
    "recognize() 仅接受图片",
    "recognize() accepts images only",
    "recognize() は画像のみ対応",
    "recognize() รับเฉพาะรูปภาพ"
  ],
  "selectImage() 仅接受图片": [
    "selectImage() 仅接受图片",
    "selectImage() accepts images only",
    "selectImage() は画像のみ対応",
    "selectImage() รับเฉพาะรูปภาพ"
  ],
  "{0} · {1} 页": [
    "{0} · {1} 页",
    "{0} · {1} pages",
    "{0} · {1} ページ",
    "{0} · {1} หน้า"
  ],
  "{0} 处 / {1} 页": [
    "{0} 处 / {1} 页",
    "{0} matches / {1} pages",
    "{0} 件 / {1} ページ",
    "{0} จุด / {1} หน้า"
  ],
  "上一页": [
    "上一页",
    "Previous page",
    "前のページ",
    "หน้าก่อนหน้า"
  ],
  "下一页": [
    "下一页",
    "Next page",
    "次のページ",
    "หน้าถัดไป"
  ],
  "仅读取文字层": [
    "仅读取文字层",
    "Text layer only",
    "テキスト層のみ",
    "ชั้นข้อความเท่านั้น"
  ],
  "从相册选择": [
    "从相册选择",
    "Choose from gallery",
    "アルバムから選択",
    "เลือกจากอัลบั้ม"
  ],
  "例如：合同编号\n付款日期\n上海": [
    "例如：合同编号\n付款日期\n上海",
    "Example: Contract number\nPayment date\nShanghai",
    "例：契約番号\n支払日\n上海",
    "ตัวอย่าง: เลขที่สัญญา\nวันที่ชำระเงิน\nเซี่ยงไฮ้"
  ],
  "停止": [
    "停止",
    "Stop",
    "停止",
    "หยุด"
  ],
  "全屏预览": [
    "全屏预览",
    "Fullscreen preview",
    "全画面プレビュー",
    "ดูตัวอย่างเต็มหน้าจอ"
  ],
  "全文": [
    "全文",
    "Full text",
    "全文",
    "ข้อความทั้งหมด"
  ],
  "全部字符串的检索结果": [
    "全部字符串的检索结果",
    "Results for all search strings",
    "すべての文字列の検索結果",
    "ผลการค้นหาทุกข้อความ"
  ],
  "全部页面": [
    "全部页面",
    "All pages",
    "すべてのページ",
    "ทุกหน้า"
  ],
  "全部页面已完成": [
    "全部页面已完成",
    "All pages completed",
    "全ページ完了",
    "เสร็จครบทุกหน้า"
  ],
  "全页 OCR（文字层异常时）": [
    "全页 OCR（文字层异常时）",
    "Full-page OCR (for faulty text layers)",
    "全ページ OCR（テキスト層に問題がある場合）",
    "OCR ทั้งหน้า (เมื่อชั้นข้อความผิดปกติ)"
  ],
  "关闭": [
    "关闭",
    "Close",
    "閉じる",
    "ปิด"
  ],
  "兼容模式": [
    "兼容模式",
    "Compatibility mode",
    "互換モード",
    "โหมดความเข้ากันได้"
  ],
  "分享": [
    "分享",
    "Share",
    "共有",
    "แชร์"
  ],
  "分享失败：": [
    "分享失败：",
    "Sharing failed: ",
    "共有失敗：",
    "แชร์ไม่สำเร็จ: "
  ],
  "分数不可用": [
    "分数不可用",
    "Score unavailable",
    "スコアなし",
    "ไม่มีคะแนน"
  ],
  "切换 CLS 失败：": [
    "切换 CLS 失败：",
    "CLS change failed: ",
    "CLS 切替失敗：",
    "เปลี่ยน CLS ไม่สำเร็จ: "
  ],
  "剪贴板图片预览失败：": [
    "剪贴板图片预览失败：",
    "Clipboard preview failed: ",
    "貼り付け画像のプレビュー失敗：",
    "แสดงตัวอย่างภาพจากคลิปบอร์ดไม่สำเร็จ: "
  ],
  "区分英文字母大小写": [
    "区分英文字母大小写",
    "Case sensitive",
    "大文字・小文字を区別",
    "แยกตัวพิมพ์ใหญ่เล็ก"
  ],
  "可复制以下信息反馈给项目维护者；其中不包含 PDF 内容和本地文件路径。": [
    "可复制以下信息反馈给项目维护者；其中不包含 PDF 内容和本地文件路径。",
    "Copy these diagnostics for the maintainer. They contain no PDF content or local file paths.",
    "管理者への報告用にコピーできます。PDF の内容やローカルパスは含まれません。",
    "คัดลอกข้อมูลนี้ให้ผู้ดูแลได้ ไม่มีเนื้อหา PDF หรือเส้นทางไฟล์ในอุปกรณ์"
  ],
  "后台线程": [
    "后台线程",
    "Background worker",
    "バックグラウンド処理",
    "เธรดเบื้องหลัง"
  ],
  "启动等待": [
    "{0} · 已等待 {1} 秒",
    "{0} · Waiting {1}s",
    "{0} · {1} 秒経過",
    "{0} · รอ {1} วินาที"
  ],
  "启用方向分类（CLS）": [
    "启用方向分类（CLS）",
    "Enable orientation detection (CLS)",
    "文字方向の判定（CLS）",
    "ตรวจจับทิศทางข้อความ (CLS)"
  ],
  "图像预览": [
    "图像预览",
    "Image preview",
    "画像プレビュー",
    "ตัวอย่างรูปภาพ"
  ],
  "图片": [
    "图片",
    "Image",
    "画像",
    "รูปภาพ"
  ],
  "图片已准备好，点击“开始识别”执行 OCR。": [
    "图片已准备好，点击“开始识别”执行 OCR。",
    "Image ready. Click “Start recognition” to run OCR.",
    "画像の準備完了。「認識開始」で OCR を実行します。",
    "รูปภาพพร้อมแล้ว คลิก “เริ่มรู้จำ” เพื่อทำ OCR"
  ],
  "图片预览失败：": [
    "图片预览失败：",
    "Image preview failed: ",
    "画像プレビュー失敗：",
    "แสดงตัวอย่างรูปภาพไม่สำเร็จ: "
  ],
  "处理方式": [
    "处理方式",
    "Processing mode",
    "処理方法",
    "โหมดประมวลผล"
  ],
  "复制失败：": [
    "复制失败：",
    "Copy failed: ",
    "コピー失敗：",
    "คัดลอกไม่สำเร็จ: "
  ],
  "复制文本": [
    "复制文本",
    "Copy text",
    "テキストをコピー",
    "คัดลอกข้อความ"
  ],
  "复制诊断信息": [
    "复制诊断信息",
    "Copy diagnostics",
    "診断情報をコピー",
    "คัดลอกข้อมูลวินิจฉัย"
  ],
  "复制诊断信息失败：": [
    "复制诊断信息失败：",
    "Copying diagnostics failed: ",
    "診断情報のコピー失敗：",
    "คัดลอกข้อมูลวินิจฉัยไม่สำเร็จ: "
  ],
  "完成：{0} 行": [
    "完成：{0} 行",
    "Complete: {0} lines",
    "完了：{0} 行",
    "เสร็จสิ้น: {0} บรรทัด"
  ],
  "完成：{0} 页，共 {1} 行。": [
    "完成：{0} 页，共 {1} 行。",
    "Complete: {0} pages, {1} lines.",
    "完了：{0} ページ、{1} 行。",
    "เสร็จสิ้น: {0} หน้า {1} บรรทัด"
  ],
  "定位失败：": [
    "定位失败：",
    "Could not locate match: ",
    "一致箇所への移動失敗：",
    "ไปยังจุดที่พบไม่สำเร็จ: "
  ],
  "导出 JSON": [
    "导出 JSON",
    "Export JSON",
    "JSON を出力",
    "ส่งออก JSON"
  ],
  "导出 TXT": [
    "导出 TXT",
    "Export TXT",
    "TXT を出力",
    "ส่งออก TXT"
  ],
  "就绪，请选择图片或 PDF。": [
    "就绪，请选择图片或 PDF。",
    "Ready. Choose an image or PDF.",
    "準備完了。画像または PDF を選択してください。",
    "พร้อมแล้ว เลือกรูปภาพหรือ PDF"
  ],
  "工作区视图": [
    "工作区视图",
    "Workspace view",
    "ワークスペース表示",
    "มุมมองพื้นที่ทำงาน"
  ],
  "已从剪贴板加载图片 · {0}×{1}，点击“开始识别”。": [
    "已从剪贴板加载图片 · {0}×{1}，点击“开始识别”。",
    "Image loaded from clipboard · {0}×{1}. Click “Start recognition”.",
    "クリップボードから画像を読み込みました · {0}×{1}。「認識開始」をクリックしてください。",
    "โหลดรูปภาพจากคลิปบอร์ดแล้ว · {0}×{1} คลิก “เริ่มรู้จำ”"
  ],
  "已停止：完成 {0} / {1} 页。": [
    "已停止：完成 {0} / {1} 页。",
    "Stopped: completed {0} / {1} pages.",
    "停止：{0} / {1} ページ完了。",
    "หยุดแล้ว: เสร็จ {0} / {1} หน้า"
  ],
  "已分享 {0} 行文本。": [
    "已分享 {0} 行文本。",
    "Shared {0} lines.",
    "{0} 行を共有しました。",
    "แชร์ {0} บรรทัดแล้ว"
  ],
  "已复制 {0} 行文本。": [
    "已复制 {0} 行文本。",
    "Copied {0} lines.",
    "{0} 行をコピーしました。",
    "คัดลอก {0} บรรทัดแล้ว"
  ],
  "已导出 {0} 行 {1}。": [
    "已导出 {0} 行 {1}。",
    "Exported {0} lines as {1}.",
    "{0} 行を {1} で出力しました。",
    "ส่งออก {0} บรรทัดเป็น {1} แล้ว"
  ],
  "已检查 {0} / {1} 页 · ": [
    "已检查 {0} / {1} 页 · ",
    "Checked {0} / {1} pages · ",
    "{0} / {1} ページを確認済み · ",
    "ตรวจแล้ว {0} / {1} หน้า · "
  ],
  "已检查页面未找到": [
    "已检查页面未找到",
    "Not found in checked pages",
    "確認済みページでは一致なし",
    "ไม่พบในหน้าที่ตรวจแล้ว"
  ],
  "已选择：{0} · {1}×{2}，点击“开始识别”。": [
    "已选择：{0} · {1}×{2}，点击“开始识别”。",
    "Selected: {0} · {1}×{2}. Click “Start recognition”.",
    "選択済み：{0} · {1}×{2}。「認識開始」をクリックしてください。",
    "เลือกแล้ว: {0} · {1}×{2} คลิก “เริ่มรู้จำ”"
  ],
  "开启": [
    "开启",
    "On",
    "オン",
    "เปิด"
  ],
  "开始识别": [
    "开始识别",
    "Start recognition",
    "認識開始",
    "เริ่มรู้จำ"
  ],
  "引擎加载失败": [
    "引擎加载失败",
    "Engine loading failed",
    "エンジン読み込み失敗",
    "โหลดเอนจินไม่สำเร็จ"
  ],
  "引擎状态：加载中": [
    "引擎状态：加载中",
    "Engine: loading",
    "エンジン：読み込み中",
    "เอนจิน: กำลังโหลด"
  ],
  "当前 HTML 构建未包含 PDF 支持。": [
    "当前 HTML 构建未包含 PDF 支持。",
    "This HTML build does not include PDF support.",
    "この HTML は PDF に対応していません。",
    "HTML รุ่นนี้ไม่รองรับ PDF"
  ],
  "当前浏览器无法初始化 PDF 组件，请更新浏览器或改用系统 Chrome/Safari 打开。": [
    "当前浏览器无法初始化 PDF 组件，请更新浏览器或改用系统 Chrome/Safari 打开。",
    "PDF initialization failed. Update your browser or try Chrome/Safari.",
    "PDF を初期化できません。ブラウザーを更新するか Chrome/Safari をお試しください。",
    "เริ่มต้น PDF ไม่สำเร็จ โปรดอัปเดตเบราว์เซอร์หรือลอง Chrome/Safari"
  ],
  "当前浏览器无法读取所选 PDF，请尝试系统 Chrome/Safari 或重新选择文件。": [
    "当前浏览器无法读取所选 PDF，请尝试系统 Chrome/Safari 或重新选择文件。",
    "Cannot read this PDF. Try Chrome/Safari or select the file again.",
    "PDF を読み取れません。Chrome/Safari を使うか、ファイルを選択し直してください。",
    "อ่าน PDF ไม่ได้ โปรดลอง Chrome/Safari หรือเลือกไฟล์อีกครั้ง"
  ],
  "当前页": [
    "当前页",
    "Current page",
    "現在のページ",
    "หน้าปัจจุบัน"
  ],
  "待检查": [
    "待检查",
    "Pending",
    "未確認",
    "รอตรวจ"
  ],
  "快速 · 144 DPI": [
    "快速 · 144 DPI",
    "Fast · 144 DPI",
    "高速 · 144 DPI",
    "เร็ว · 144 DPI"
  ],
  "忽略空白与换行": [
    "忽略空白与换行",
    "Ignore whitespace & line breaks",
    "空白・改行を無視",
    "ละเว้นช่องว่างและการขึ้นบรรทัดใหม่"
  ],
  "想在文件中查找什么？每行输入一个字符串": [
    "想在文件中查找什么？每行输入一个字符串",
    "What do you want to find? One string per line.",
    "検索する文字列を 1 行に 1 つ入力してください",
    "ต้องการค้นหาอะไร? ป้อนหนึ่งข้อความต่อบรรทัด"
  ],
  "拍照识别": [
    "拍照识别",
    "Take photo",
    "撮影して認識",
    "ถ่ายภาพเพื่อรู้จำ"
  ],
  "支持 JPG、PNG、BMP、WebP、PDF；图片也可直接 Ctrl+V / ⌘V 粘贴截图，所有文件仅在本机处理": [
    "支持 JPG、PNG、BMP、WebP、PDF；图片也可直接 Ctrl+V / ⌘V 粘贴截图，所有文件仅在本机处理",
    "JPG, PNG, BMP, WebP, PDF. Paste screenshots with Ctrl+V / ⌘V. Files are processed locally.",
    "JPG・PNG・BMP・WebP・PDF 対応。Ctrl+V / ⌘V で画像を貼り付け。処理は端末内で完結します。",
    "รองรับ JPG, PNG, BMP, WebP, PDF วางภาพด้วย Ctrl+V / ⌘V ไฟล์ประมวลผลในอุปกรณ์เท่านั้น"
  ],
  "支持 JPG、PNG、BMP、WebP，也可直接 Ctrl+V / ⌘V 粘贴截图，所有文件仅在本机处理": [
    "支持 JPG、PNG、BMP、WebP，也可直接 Ctrl+V / ⌘V 粘贴截图，所有文件仅在本机处理",
    "JPG, PNG, BMP, WebP. Paste screenshots with Ctrl+V / ⌘V. Processing stays on this device.",
    "JPG・PNG・BMP・WebP 対応。Ctrl+V / ⌘V で画像を貼り付け。端末内で処理します。",
    "รองรับ JPG, PNG, BMP, WebP วางภาพด้วย Ctrl+V / ⌘V ประมวลผลในอุปกรณ์เท่านั้น"
  ],
  "放大": [
    "放大",
    "Zoom in",
    "拡大",
    "ขยาย"
  ],
  "文件与识别设置": [
    "文件与识别设置",
    "File & recognition settings",
    "ファイルと認識設定",
    "ไฟล์และการตั้งค่าการรู้จำ"
  ],
  "文件已准备好，点击“开始识别”。": [
    "文件已准备好，点击“开始识别”。",
    "File ready. Click “Start recognition”.",
    "ファイルの準備完了。「認識開始」をクリックしてください。",
    "ไฟล์พร้อมแล้ว คลิก “เริ่มรู้จำ”"
  ],
  "文字层匹配 · 置信度不适用": [
    "文字层匹配 · 置信度不适用",
    "Text-layer match · Confidence not applicable",
    "テキスト層の一致 · 信頼度は対象外",
    "พบในชั้นข้อความ · ไม่ใช้ค่าความเชื่อมั่น"
  ],
  "显示标注": [
    "显示标注",
    "Show highlights",
    "強調表示を表示",
    "แสดงไฮไลต์"
  ],
  "未找到": [
    "未找到",
    "Not found",
    "一致なし",
    "ไม่พบ"
  ],
  "未检测到文本。": [
    "未检测到文本。",
    "No text detected.",
    "テキストが見つかりません。",
    "ไม่พบข้อความ"
  ],
  "标准 · 180 DPI": [
    "标准 · 180 DPI",
    "Standard · 180 DPI",
    "標準 · 180 DPI",
    "มาตรฐาน · 180 DPI"
  ],
  "检索字符串": [
    "检索字符串",
    "Search strings",
    "検索文字列",
    "ข้อความที่ต้องการค้นหา"
  ],
  "检索结果 · 点击命中项定位": [
    "检索结果 · 点击命中项定位",
    "Search results · Click a match to locate",
    "検索結果 · 一致箇所をクリックして移動",
    "ผลการค้นหา · คลิกเพื่อไปยังจุดที่พบ"
  ],
  "横排（从左到右）": [
    "横排（从左到右）",
    "Horizontal (left to right)",
    "横書き（左から右）",
    "แนวนอน (ซ้ายไปขวา)"
  ],
  "正在停止；若当前页已进入 OCR，将在本页完成后停止…": [
    "正在停止；若当前页已进入 OCR，将在本页完成后停止…",
    "Stopping; if OCR has started, this page will finish first…",
    "停止中です。OCR が開始済みの場合は現在のページの完了後に停止します…",
    "กำลังหยุด หากเริ่ม OCR แล้ว จะหยุดหลังหน้าปัจจุบันเสร็จ…"
  ],
  "正在准备图片…": [
    "正在准备图片…",
    "Preparing image…",
    "画像を準備中…",
    "กำลังเตรียมรูปภาพ…"
  ],
  "正在初始化 WASM 和模型": [
    "正在初始化 WASM 和模型",
    "Initializing WASM and models",
    "WASM とモデルを初期化中",
    "กำลังเริ่มต้น WASM และโมเดล"
  ],
  "正在加载 WASM 和模型…": [
    "正在加载 WASM 和模型…",
    "Loading WASM and models…",
    "WASM とモデルを読み込み中…",
    "กำลังโหลด WASM และโมเดล…"
  ],
  "正在加载离线引擎…": [
    "正在加载离线引擎…",
    "Loading offline engine…",
    "オフラインエンジンを読み込み中…",
    "กำลังโหลดเอนจินออฟไลน์…"
  ],
  "正在处理第 {0} / {1} 页：渲染…": [
    "正在处理第 {0} / {1} 页：渲染…",
    "Processing page {0} / {1}: rendering…",
    "{0} / {1} ページ：描画中…",
    "กำลังประมวลผลหน้า {0} / {1}: แสดงผล…"
  ],
  "正在处理第 {0} / {1} 页：读取文字 / OCR…": [
    "正在处理第 {0} / {1} 页：读取文字 / OCR…",
    "Processing page {0} / {1}: text extraction / OCR…",
    "{0} / {1} ページ：テキスト抽出 / OCR…",
    "กำลังประมวลผลหน้า {0} / {1}: อ่านข้อความ / OCR…"
  ],
  "正在打开 PDF…": [
    "正在打开 PDF…",
    "Opening PDF…",
    "PDF を開いています…",
    "กำลังเปิด PDF…"
  ],
  "正在渲染第 {0} / {1} 页预览…": [
    "正在渲染第 {0} / {1} 页预览…",
    "Rendering preview {0} / {1}…",
    "{0} / {1} ページを描画中…",
    "กำลังแสดงตัวอย่างหน้า {0} / {1}…"
  ],
  "正在识别，请稍后再粘贴图片。": [
    "正在识别，请稍后再粘贴图片。",
    "Recognition in progress. Paste your image later.",
    "認識中です。完了後に画像を貼り付けてください。",
    "กำลังรู้จำ โปรดวางรูปภาพภายหลัง"
  ],
  "正在识别，页面仍可正常操作…": [
    "正在识别，页面仍可正常操作…",
    "Recognizing. You can keep using the page…",
    "認識中です。画面は引き続き操作できます…",
    "กำลังรู้จำ คุณยังใช้งานหน้าเว็บได้…"
  ],
  "正在读取并解析内嵌引擎": [
    "正在读取并解析内嵌引擎",
    "Reading embedded engine",
    "内蔵エンジンを読み込み中",
    "กำลังอ่านเอนจินที่ฝังไว้"
  ],
  "此 PDF 已加密，当前版本暂不支持密码输入。": [
    "此 PDF 已加密，当前版本暂不支持密码输入。",
    "This PDF is encrypted. Password entry is not supported yet.",
    "暗号化された PDF です。パスワード入力は未対応です。",
    "PDF นี้เข้ารหัส ยังไม่รองรับการป้อนรหัสผ่าน"
  ],
  "浅色主题": [
    "浅色主题",
    "Light theme",
    "ライトテーマ",
    "ธีมสว่าง"
  ],
  "浏览器没有提供可读取的 PDF 文件。": [
    "浏览器没有提供可读取的 PDF 文件。",
    "No readable PDF file was provided.",
    "読み取り可能な PDF がありません。",
    "ไม่มีไฟล์ PDF ที่อ่านได้"
  ],
  "深色主题": [
    "深色主题",
    "Dark theme",
    "ダークテーマ",
    "ธีมมืด"
  ],
  "清晰 · 220 DPI": [
    "清晰 · 220 DPI",
    "High · 220 DPI",
    "高精細 · 220 DPI",
    "สูง · 220 DPI"
  ],
  "离线 PDF 检索工作台": [
    "离线 PDF 检索工作台",
    "Offline PDF Search",
    "オフライン PDF 検索",
    "ค้นหา PDF แบบออฟไลน์"
  ],
  "竖排（从右到左）": [
    "竖排（从右到左）",
    "Vertical (right to left)",
    "縦書き（右から左）",
    "แนวตั้ง (ขวาไปซ้าย)"
  ],
  "竖排（从左到右）": [
    "竖排（从左到右）",
    "Vertical (left to right)",
    "縦書き（左から右）",
    "แนวตั้ง (ซ้ายไปขวา)"
  ],
  "第 {0} 处 · {1}": [
    "第 {0} 处 · {1}",
    "Match {0} · {1}",
    "一致 {0} · {1}",
    "จุดที่ {0} · {1}"
  ],
  "第 {0} 页 · {1} · {2}": [
    "第 {0} 页 · {1} · {2}",
    "Page {0} · {1} · {2}",
    "{0} ページ · {1} · {2}",
    "หน้า {0} · {1} · {2}"
  ],
  "第 {0} 页 · {1} 处": [
    "第 {0} 页 · {1} 处",
    "Page {0} · {1} matches",
    "{0} ページ · {1} 件",
    "หน้า {0} · {1} จุด"
  ],
  "第 {0} 页已识别，共 {1} 行{2}。": [
    "第 {0} 页已识别，共 {1} 行{2}。",
    "Page {0}: {1} lines recognized{2}.",
    "{0} ページ：{1} 行を認識済み{2}。",
    "หน้า {0}: รู้จำแล้ว {1} บรรทัด{2}"
  ],
  "等待识别 · {0} 个字符串": [
    "等待识别 · {0} 个字符串",
    "Awaiting recognition · {0} strings",
    "認識待ち · {0} 文字列",
    "รอการรู้จำ · {0} ข้อความ"
  ],
  "结果": [
    "结果",
    "Results",
    "結果",
    "ผลลัพธ์"
  ],
  "结果尚不完整，未处理页面尚未检查": [
    "结果尚不完整，未处理页面尚未检查",
    "Incomplete results; unprocessed pages have not been checked",
    "結果は未完了です。未処理ページは未確認です",
    "ผลยังไม่ครบ หน้าที่ยังไม่ประมวลผลยังไม่ได้ตรวจ"
  ],
  "统计PDF": [
    "{0} / {1} 页 · {2} 行 · PDF 打开 {3} ms · 页面渲染 {4} ms · OCR {5} ms · 总计 {6} ms",
    "{0} / {1} pages · {2} lines · PDF load {3} ms · Render {4} ms · OCR {5} ms · Total {6} ms",
    "{0} / {1} ページ · {2} 行 · PDF 読込 {3} ms · 描画 {4} ms · OCR {5} ms · 合計 {6} ms",
    "{0} / {1} หน้า · {2} บรรทัด · โหลด PDF {3} ms · แสดงผล {4} ms · OCR {5} ms · รวม {6} ms"
  ],
  "统计图片": [
    "第 {0} 次 · {1} · 图像准备 {2} ms · 推理 {3} ms · 总计 {4} ms · CLS {5}",
    "Run {0} · {1} · Image preparation {2} ms · Inference {3} ms · Total {4} ms · CLS {5}",
    "{0} 回目 · {1} · 画像準備 {2} ms · 推論 {3} ms · 合計 {4} ms · CLS {5}",
    "ครั้งที่ {0} · {1} · เตรียมภาพ {2} ms · อนุมาน {3} ms · รวม {4} ms · CLS {5}"
  ],
  "统计就绪": [
    "引擎已就绪 · {0} · 输出 {1} 行/{2} 字节 · CLS {3}",
    "Engine ready · {0} · Capacity {1} lines / {2} bytes · CLS {3}",
    "エンジン準備完了 · {0} · 最大 {1} 行 / {2} バイト · CLS {3}",
    "เอนจินพร้อม · {0} · ความจุ {1} บรรทัด / {2} ไบต์ · CLS {3}"
  ],
  "缩小": [
    "缩小",
    "Zoom out",
    "縮小",
    "ย่อ"
  ],
  "自动：文字层 + 扫描图 OCR": [
    "自动：文字层 + 扫描图 OCR",
    "Auto: text layer + scanned-image OCR",
    "自動：テキスト層 + スキャン画像 OCR",
    "อัตโนมัติ: ชั้นข้อความ + OCR ภาพสแกน"
  ],
  "识别后修改字符串即可重新检索，无需重复 OCR。按字面匹配，统一全角/半角；不进行模糊匹配。标注覆盖命中的 PDF 文本片段或 OCR 文字行，同一行的多次命中分别计数。": [
    "识别后修改字符串即可重新检索，无需重复 OCR。按字面匹配，统一全角/半角；不进行模糊匹配。标注覆盖命中的 PDF 文本片段或 OCR 文字行，同一行的多次命中分别计数。",
    "Edit strings after recognition to search again without rerunning OCR. Literal matching normalizes full/half-width characters. Highlights cover PDF text segments or OCR lines; repeated hits on one line are counted separately.",
    "認識後は文字列を変更するだけで再検索できます。全角・半角を統一した文字列一致で、あいまい検索は行いません。PDF のテキスト断片または OCR 行を強調表示し、同じ行の複数の一致も別々に数えます。",
    "แก้ข้อความหลังรู้จำเพื่อค้นหาใหม่โดยไม่ต้อง OCR ซ้ำ ค้นหาตามตัวอักษรโดยปรับอักขระเต็ม/ครึ่งความกว้างให้ตรงกัน ไม่ค้นหาแบบคลุมเครือ ไฮไลต์ส่วนข้อความ PDF หรือบรรทัด OCR และนับแต่ละจุดที่พบแยกกัน"
  ],
  "识别失败：": [
    "识别失败：",
    "Recognition failed: ",
    "認識失敗：",
    "รู้จำไม่สำเร็จ: "
  ],
  "识别结果": [
    "识别结果",
    "Recognized text",
    "認識結果",
    "ผลการรู้จำ"
  ],
  "识别结果导出": [
    "识别结果导出",
    "Export recognized text",
    "認識結果の出力",
    "ส่งออกผลการรู้จำ"
  ],
  "识别范围": [
    "识别范围",
    "Page range",
    "対象ページ",
    "ช่วงหน้า"
  ],
  "识别进度": [
    "识别进度",
    "Recognition progress",
    "認識の進捗",
    "ความคืบหน้าการรู้จำ"
  ],
  "识别进度与状态": [
    "识别进度与状态",
    "Progress & status",
    "進捗と状態",
    "ความคืบหน้าและสถานะ"
  ],
  "语言": [
    "语言",
    "Language",
    "言語",
    "ภาษา"
  ],
  "请先选择图片": [
    "请先选择图片",
    "Choose an image first",
    "先に画像を選択してください",
    "โปรดเลือกรูปภาพก่อน"
  ],
  "进度complete": [
    "已完成",
    "Complete",
    "完了",
    "เสร็จสิ้น"
  ],
  "进度error": [
    "失败",
    "Failed",
    "失敗",
    "ไม่สำเร็จ"
  ],
  "进度processing": [
    "正在识别",
    "Recognizing",
    "認識中",
    "กำลังรู้จำ"
  ],
  "进度stopped": [
    "已停止",
    "Stopped",
    "停止済み",
    "หยุดแล้ว"
  ],
  "进度格式": [
    "{0} · {1} / {2} 页 · {3}%",
    "{0} · {1} / {2} pages · {3}%",
    "{0} · {1} / {2} ページ · {3}%",
    "{0} · {1} / {2} หน้า · {3}%"
  ],
  "适合宽度": [
    "适合宽度",
    "Fit width",
    "幅に合わせる",
    "พอดีความกว้าง"
  ],
  "选择、拖入或粘贴图片": [
    "选择、拖入或粘贴图片",
    "Choose, drop or paste an image",
    "画像を選択・ドロップ・貼り付け",
    "เลือก ลาก หรือวางรูปภาพ"
  ],
  "选择图片": [
    "选择图片",
    "Choose image",
    "画像を選択",
    "เลือกรูปภาพ"
  ],
  "选择图片 / PDF": [
    "选择图片 / PDF",
    "Choose image / PDF",
    "画像 / PDF を選択",
    "เลือกรูปภาพ / PDF"
  ],
  "选择或拖入图片 / PDF，也可粘贴图片": [
    "选择或拖入图片 / PDF，也可粘贴图片",
    "Choose or drop an image / PDF, or paste an image",
    "画像・PDF を選択／ドロップ、または画像を貼り付け",
    "เลือกหรือลากรูปภาพ / PDF หรือวางรูปภาพ"
  ],
  "选择文件后，这里会显示识别文本。": [
    "选择文件后，这里会显示识别文本。",
    "Choose a file to see recognized text here.",
    "ファイルを選択すると、認識結果がここに表示されます。",
    "เลือกไฟล์เพื่อแสดงข้อความที่รู้จำที่นี่"
  ],
  "阅读顺序": [
    "阅读顺序",
    "Reading order",
    "読み順",
    "ลำดับการอ่าน"
  ],
  "隐藏标注": [
    "隐藏标注",
    "Hide highlights",
    "強調表示を隠す",
    "ซ่อนไฮไลต์"
  ],
  "（相关行最低分）": [
    "（相关行最低分）",
    " (minimum of matched lines)",
    "（関連行の最低スコア）",
    " (คะแนนต่ำสุดของบรรทัดที่เกี่ยวข้อง)"
  ],
  "，点击“开始识别”。": [
    "，点击“开始识别”。",
    ". Click “Start recognition”.",
    "。「認識開始」をクリックしてください。",
    " คลิก “เริ่มรู้จำ”"
  ]
};
  function readPreference(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }
  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* file:// storage may be unavailable */ }
  }
  let language = readPreference("lw-language", "zh-CN");
  if (!languages.includes(language)) language = "zh-CN";
  let theme = readPreference("lw-theme", "light") === "dark" ? "dark" : "light";
  function t(key, ...args) {
    const text = messages[key] ? messages[key][languages.indexOf(language)] : key;
    return String(text).replace(/\{(\d+)\}/g, (_, index) => args[index] === undefined ? "" : String(args[index]));
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById("theme-toggle");
    if (button) {
      const label = t(theme === "dark" ? "浅色主题" : "深色主题");
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    }
  }
  function apply() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach(node => {
      node.textContent = t(node.dataset.i18n);
    });
    for (const attribute of ["aria-label", "placeholder"]) {
      document.querySelectorAll("[data-i18n-" + attribute + "]").forEach(node => {
        node.setAttribute(attribute, t(node.getAttribute("data-i18n-" + attribute)));
      });
    }
    const selector = document.getElementById("language");
    const names = {"zh-CN":"中文", ja:"日本語", en:"English", th:"ไทย"};
    if (selector) {
      const label = t("语言") + " · " + names[language];
      selector.setAttribute("aria-label", label);
      selector.setAttribute("title", label);
    }
    const flag = document.getElementById("language-flag");
    if (flag) flag.setAttribute("href", "#flag-" + language);
    for (const code of languages) {
      const option = document.getElementById("language-" + code);
      if (option) option.setAttribute("aria-pressed", String(code === language));
    }
    applyTheme();
    document.title = t("离线 PDF 检索工作台");
  }
  function setLanguage(value) {
    if (!languages.includes(value)) return;
    language = value;
    savePreference("lw-language", value);
    apply();
    root.dispatchEvent(new CustomEvent("lw:language"));
  }
  function setTheme(value) {
    theme = value === "dark" ? "dark" : "light";
    savePreference("lw-theme", theme);
    applyTheme();
  }
  root.LwI18n = Object.freeze({t, apply, setLanguage, setTheme,
    get language() { return language; }, get theme() { return theme; }, messages, languages});
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
})(globalThis);
