/*
 * UI glue for the standalone example.
 *
 * LwPpocr remains an image-only OCR SDK. LwPdf is an optional document
 * frontend that renders one PDF page at a time to Canvas. This file joins both
 * application-layer APIs and owns preview, progress, and export behavior.
 */
(function() {
  "use strict";

  const t = (...args) => LwI18n.t(...args);
  function setStatus(render) { statusNode._renderStatus = render; statusNode.textContent = render(); }
  const IMAGE_MAX_SIDE = 1600;
  const PDF_MAX_PIXELS = 5000000;
  const PDF_PREVIEW_MAX_PIXELS = 3000000;
  const PDF_PREVIEW_DPI = 144;

  const searchInput = document.getElementById("search-queries");
  const searchCase = document.getElementById("search-case");
  const searchSpaces = document.getElementById("search-spaces");
  const searchSummary = document.getElementById("search-summary");
  const searchResultsNode = document.getElementById("search-results");
  const searchCoverage = document.getElementById("search-coverage");
  const pdfMode = document.getElementById("pdf-mode");
  let selectedMatch = null;
  let latestProgress = null;
  const fileInput = document.getElementById("file");
  const cameraInput = document.getElementById("camera");
  const dropzone = document.getElementById("dropzone");
  const runButton = document.getElementById("run");
  const clsInput = document.getElementById("use-cls");
  const readingOrderInput = document.getElementById("reading-order");
  const statusNode = document.getElementById("status");
  const statsNode = document.getElementById("stats");
  const canvas = document.getElementById("canvas");
  const overlay = document.getElementById("overlay");
  const workspace = document.getElementById("workspace");
  const previewTitle = document.getElementById("preview-title");
  const toggleOverlayButton = document.getElementById("toggle-overlay");
  const showImageButton = document.getElementById("show-image");
  const showResultsButton = document.getElementById("show-results");
  const resultsNode = document.getElementById("results");
  const copyTextButton = document.getElementById("copy-text");
  const shareResultButton = document.getElementById("share-result");
  const exportTxtButton = document.getElementById("export-txt");
  const exportJsonButton = document.getElementById("export-json");
  const pdfControls = document.getElementById("pdf-controls");
  const pdfMeta = document.getElementById("pdf-meta");
  const pdfScope = document.getElementById("pdf-scope");
  const pdfDpi = document.getElementById("pdf-dpi");
  const pdfPrev = document.getElementById("pdf-prev");
  const pdfNext = document.getElementById("pdf-next");
  const pdfPageLabel = document.getElementById("pdf-page-label");
  const pdfProgress = document.getElementById("pdf-progress");
  const pdfProgressBar = document.getElementById("pdf-progress-bar");
  const pdfProgressLabel = document.getElementById("pdf-progress-label");
  const pdfDiagnostics = document.getElementById("pdf-diagnostics");
  const pdfDiagnosticsText = document.getElementById("pdf-diagnostics-text");
  const copyPdfDiagnosticsButton = document.getElementById("copy-pdf-diagnostics");
  const pdfResultTabs = document.getElementById("pdf-result-tabs");
  const showPageResultButton = document.getElementById("show-page-result");
  const showFullResultButton = document.getElementById("show-full-result");
  const exportButtons = [copyTextButton, exportTxtButton, exportJsonButton];
  const resultActionButtons = [...exportButtons, shareResultButton];

  let engine = null;
  let enginePromise = null;
  let source = null;
  let preparedSource = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let prepareMilliseconds = 0;
  let prepareCount = 0;
  let runCount = 0;
  let previewSequence = 0;
  let running = false;
  let pdfPreviewRunning = false;
  let lastResults = null;
  let lastTimingBreakdown = null;
  let pdfResultView = "page";
  let overlayVisible = true;


  const previewContent = document.getElementById("preview-content");
  const previewViewport = document.getElementById("preview-viewport");
  const previewStage = document.getElementById("preview-stage");
  const previewDialog = document.getElementById("preview-dialog");
  const fullscreenButton = document.getElementById("preview-fullscreen");
  const zoomInButton = document.getElementById("zoom-in");
  const zoomOutButton = document.getElementById("zoom-out");
  const zoomFitButton = document.getElementById("zoom-fit");
  const previewPrev = document.getElementById("preview-prev");
  const previewNext = document.getElementById("preview-next");
  let zoom = 1;
  let fitPreview = true;
  let returnFocus = null;
  let previewPan = null;

  function endPreviewPan(event) {
    if (!previewPan || (event && event.pointerId !== previewPan.id)) return;
    const id = previewPan.id;
    previewPan = null;
    previewViewport.classList.remove("panning");
    if (previewViewport.hasPointerCapture(id)) previewViewport.releasePointerCapture(id);
  }
  previewStage.addEventListener("pointerdown", event => {
    // 触摸屏使用浏览器原生滚动和双指缩放；鼠标与触控笔使用指针捕获。
    if (!source || previewPan || event.button !== 0 || event.isPrimary === false ||
        event.pointerType === "touch") return;
    previewViewport.setPointerCapture(event.pointerId);
    previewPan = {id: event.pointerId, x: event.clientX, y: event.clientY};
    previewViewport.classList.add("panning");
    event.preventDefault();
  });
  previewViewport.addEventListener("pointermove", event => {
    if (!previewPan || event.pointerId !== previewPan.id) return;
    if (!(event.buttons & 1)) { endPreviewPan(event); return; }
    // 移动滚动位置而非画布坐标，确保 PDF 与标注始终同步。
    previewViewport.scrollLeft += previewPan.x - event.clientX;
    previewViewport.scrollTop += previewPan.y - event.clientY;
    previewPan.x = event.clientX;
    previewPan.y = event.clientY;
    event.preventDefault();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type =>
    previewViewport.addEventListener(type, endPreviewPan));
  window.addEventListener("blur", () => endPreviewPan());
  previewStage.addEventListener("dragstart", event => event.preventDefault());

  function setRegionOpen(name, open) {
    if (name === "preview" && !open) endPreviewPan();
    document.getElementById(name + "-collapse").setAttribute("aria-expanded", String(open));
    document.getElementById(name + "-content").hidden = !open;
    document.getElementById(name === "preview" ? "preview-region" : "results-region")
      .classList.toggle("collapsed", !open);
    if (name === "preview" && open) applyZoom();
  }
  function applyZoom() {
    previewStage.classList.toggle("pan-ready", Boolean(source));
    // Zoom is relative to the viewport width, independent of OCR render DPI.
    const width = previewViewport.clientWidth;
    if (width > 0) {
      const padding = parseFloat(getComputedStyle(previewViewport).paddingLeft) +
        parseFloat(getComputedStyle(previewViewport).paddingRight);
      previewStage.style.width = Math.max(1, Math.round((width - padding) * zoom)) + "px";
    }
    document.getElementById("zoom-label").textContent = Math.round(zoom * 100) + "%";
    zoomInButton.disabled = !source || zoom >= 4;
    zoomOutButton.disabled = !source || zoom <= .25;
    zoomFitButton.disabled = !source;
    fullscreenButton.disabled = !source;
    zoomFitButton.setAttribute("aria-pressed", String(fitPreview));
  }
  function changeZoom(delta) {
    if (!source) return;
    endPreviewPan();
    zoom = Math.max(.25, Math.min(4, Math.round((zoom + delta) * 100) / 100));
    fitPreview = false;
    applyZoom();
  }
  function updatePreviewControls(pdf) {
    document.getElementById("preview-page-nav").hidden = !pdf;
    document.getElementById("preview-page-label").textContent = pdf ? pdf.currentPage + " / " + pdf.pageCount : "0 / 0";
    previewPrev.disabled = !pdf || running || pdfPreviewRunning || pdf.currentPage <= 1;
    previewNext.disabled = !pdf || running || pdfPreviewRunning || pdf.currentPage >= pdf.pageCount;
    applyZoom();
  }
  function restorePreview() {
    if (previewContent.parentNode !== document.getElementById("dialog-content")) return;
    endPreviewPan();
    document.getElementById("preview-region").appendChild(previewContent);
    fullscreenButton.hidden = false;
    document.body.classList.remove("preview-modal-open");
    applyZoom();
    if (returnFocus) returnFocus.focus();
    returnFocus = null;
  }
  function closePreview() {
    if (previewDialog.open) previewDialog.close();
    restorePreview();
  }
  function openPreview() {
    if (!source || previewDialog.open) return;
    endPreviewPan();
    returnFocus = document.activeElement;
    setRegionOpen("preview", true);
    document.getElementById("dialog-content").appendChild(previewContent);
    fullscreenButton.hidden = true;
    previewDialog.showModal();
    document.body.classList.add("preview-modal-open");
    applyZoom();
    document.getElementById("preview-close").focus();
  }
  function updateProgress(completed, total, state) {
    latestProgress = {completed, total, state};
    pdfProgress.hidden = false;
    pdfProgress.dataset.running = String(state === "processing");
    pdfProgressBar.setAttribute("aria-valuemax", String(total));
    pdfProgressBar.setAttribute("aria-valuenow", String(completed));
    const percent = total ? Math.round(completed / total * 100) : 0;
    document.getElementById("progress-fill").style.width = percent + "%";
    pdfProgressLabel.textContent = t("进度格式", t("进度" + state), completed, total, percent);
    pdfProgressBar.setAttribute("aria-valuetext", pdfProgressLabel.textContent);
  }
  ["preview", "results"].forEach(name => {
    const button = document.getElementById(name + "-collapse");
    button.addEventListener("click", () => setRegionOpen(name, button.getAttribute("aria-expanded") !== "true"));
  });
  zoomInButton.addEventListener("click", () => changeZoom(.25));
  zoomOutButton.addEventListener("click", () => changeZoom(-.25));
  zoomFitButton.addEventListener("click", () => { endPreviewPan(); zoom = 1; fitPreview = true; applyZoom(); });
  fullscreenButton.addEventListener("click", openPreview);
  document.getElementById("preview-close").addEventListener("click", closePreview);
  previewDialog.addEventListener("close", restorePreview);
  previewPrev.addEventListener("click", () => navigatePdf(-1).catch(error => setStatus(() => t("图片预览失败：") + error)));
  previewNext.addEventListener("click", () => navigatePdf(1).catch(error => setStatus(() => t("图片预览失败：") + error)));
  window.addEventListener("resize", applyZoom);
  if (window.ResizeObserver) new ResizeObserver(applyZoom).observe(previewViewport);
  const languagePicker = document.getElementById("language-picker");
  for (const code of LwI18n.languages) {
    document.getElementById("language-" + code).addEventListener("click", () => {
      LwI18n.setLanguage(code);
      languagePicker.open = false;
      document.getElementById("language").focus();
    });
  }
  languagePicker.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      languagePicker.open = false;
      document.getElementById("language").focus();
      event.preventDefault();
    }
  });
  document.addEventListener("click", event => {
    if (!languagePicker.contains(event.target)) languagePicker.open = false;
  });
  document.getElementById("theme-toggle").addEventListener("click", () => LwI18n.setTheme(LwI18n.theme === "dark" ? "light" : "dark"));
  window.addEventListener("lw:language", () => {
    setOverlayVisible(overlayVisible);
    runButton.textContent = running && source && source.kind === "pdf" ? t("停止") : t("开始识别");
    updatePdfControls();
    if (engine) updateStats(engine.getStatus(), latestStatsResult);
    if (latestProgress) updateProgress(latestProgress.completed, latestProgress.total, latestProgress.state);
    if (lastResults) {
      if (lastResults.schema_version === 2) renderPdfResultView();
      else renderResults(lastResults.lines);
    }
    refreshSearch();
    if (statusNode._renderStatus) statusNode.textContent = statusNode._renderStatus();
  });
  LwI18n.apply();
  applyZoom();

  function clipboardExtension(type) {
    switch (String(type || "").toLowerCase()) {
      case "image/jpeg": return ".jpg";
      case "image/webp": return ".webp";
      case "image/bmp": return ".bmp";
      default: return ".png";
    }
  }

  function clipboardFileName(type) {
    const now = new Date();
    const pad = value => String(value).padStart(2, "0");
    return "clipboard-" + now.getFullYear() +
      pad(now.getMonth() + 1) + pad(now.getDate()) + "-" +
      pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) +
      clipboardExtension(type);
  }

  function clipboardImageFile(event) {
    const clipboard = event && event.clipboardData;
    if (!clipboard) return null;
    const items = clipboard.items || [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.kind === "file" && String(item.type || "").startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    const files = clipboard.files || [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (String(file.type || "").startsWith("image/")) return file;
    }
    return null;
  }

  function normalizeClipboardImage(file) {
    return new File([file], clipboardFileName(file.type), {
      type: file.type || "image/png",
      lastModified: Date.now()
    });
  }

  function setOverlayVisible(visible) {
    overlayVisible = Boolean(visible);
    if (overlayVisible) overlay.removeAttribute("hidden");
    else overlay.setAttribute("hidden", "");
    toggleOverlayButton.textContent = overlayVisible ? t("隐藏标注") : t("显示标注");
    toggleOverlayButton.setAttribute("aria-pressed", String(overlayVisible));
  }

  if (!window.LwPdf) {
    fileInput.accept = "image/*";
    const dropTitle = dropzone.querySelector("strong");
    const dropHint = dropzone.querySelector("span");
    const galleryLabel = document.querySelector('.source-button[for="file"]');
    if (dropTitle) dropTitle.dataset.i18n = "选择、拖入或粘贴图片";
    if (dropHint) dropHint.dataset.i18n =
      "支持 JPG、PNG、BMP、WebP，也可直接 Ctrl+V / ⌘V 粘贴截图，所有文件仅在本机处理";
    if (galleryLabel) galleryLabel.dataset.i18n = "从相册选择";
    LwI18n.apply();
  }

  function sourceKind(file) {
    return file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) ?
      "pdf" : "image";
  }
  function pdfStatus() {
    return window.LwPdf && typeof LwPdf.getStatus === "function" ?
      LwPdf.getStatus() : null;
  }
  function clearPdfDiagnostics() {
    pdfDiagnostics.hidden = true;
    pdfDiagnostics.open = false;
    pdfDiagnosticsText.textContent = "";
  }
  function pdfErrorMessage(error) {
    const code = error && error.code ? error.code : "LW_PDF_UNKNOWN";
    const messages = {
      LW_PDF_INIT_FAILED: t("当前浏览器无法初始化 PDF 组件，请更新浏览器或改用系统 Chrome/Safari 打开。"),
      LW_PDF_INPUT_REQUIRED: t("浏览器没有提供可读取的 PDF 文件。"),
      LW_PDF_READ_FAILED: t("当前浏览器无法读取所选 PDF，请尝试系统 Chrome/Safari 或重新选择文件。"),
      LW_PDF_READ_CANCELLED: t("PDF 文件读取已取消。"),
      LW_PDF_PASSWORD_REQUIRED: t("此 PDF 已加密，当前版本暂不支持密码输入。"),
      LW_PDF_PASSWORD_INVALID: t("PDF 密码错误。"),
      LW_PDF_RENDER_FAILED: t("PDF 已打开，但首页渲染失败；浏览器兼容性或可用内存可能不足。"),
      LW_PDF_LOAD_FAILED: t("PDF 解析失败：文件可能损坏，或当前浏览器不支持该 PDF。")
    };
    return (messages[code] || t("PDF 打开失败，请查看诊断信息。")) + "（" + code + "）";
  }
  function showPdfDiagnostics(error) {
    const status = pdfStatus() || {};
    const report = {
      error_code: error && error.code ? error.code : "LW_PDF_UNKNOWN",
      error_phase: error && error.phase ? error.phase : "unknown",
      pdf: status,
      ocr_backend: engine ? engine.getStatus().backend : "not-ready"
    };
    pdfDiagnosticsText.textContent = JSON.stringify(report, null, 2);
    pdfDiagnostics.hidden = false;
    pdfDiagnostics.open = true;
    return report;
  }
  function setExportEnabled(enabled) {
    for (const button of resultActionButtons) button.disabled = !enabled;
  }
  function resultLineCount(result = lastResults) {
    if (!result) return 0;
    if (result.schema_version === 2) {
      return result.pages.reduce((total, page) => total + page.lines.length, 0);
    }
    return result.lines.length;
  }
  function clearLastResults() {
    lastResults = null;
    lastTimingBreakdown = null;
    latestStatsResult = null;
    setExportEnabled(false);
    pdfResultTabs.hidden = true;
    overlay.replaceChildren();
    selectedMatch = null;
    refreshSearch();
  }
  function plainTextResult() {
    if (!lastResults) return "";
    if (lastResults.schema_version === 2) {
      return lastResults.pages.map(page =>
        "===== Page " + page.page_number + " / " + lastResults.document.page_count + " =====\n\n" +
        page.lines.map(line => line.text).join("\n")
      ).join("\n\n");
    }
    return lastResults.lines.map(line => line.text).join("\n");
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>]/g, character =>
      ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[character]));
  }
  function exportBaseName(value) {
    const leaf = String(value || "").replace(/[\\/]/g, "_");
    const dot = leaf.lastIndexOf(".");
    const stem = (dot > 0 ? leaf.slice(0, dot) : leaf)
      .replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim().replace(/[. ]+$/g, "");
    return (stem || "ocr-result") + "-ocr";
  }
  function downloadResult(content, mimeType, extension) {
    if (!lastResults) return;
    const url = URL.createObjectURL(new Blob([content], {type: mimeType}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportBaseName(lastResults.source) + extension;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function copyTextValue(text) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
    } catch (clipboardError) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw clipboardError;
    }
  }
  async function copyPlainText() {
    if (!lastResults) return;
    const result = lastResults;
    const text = plainTextResult();
    await copyTextValue(text);
    if (lastResults === result) {
      setStatus(() => t("已复制 {0} 行文本。", resultLineCount(result)));
    }
  }
  async function shareResult() {
    if (!lastResults || !navigator.share) return;
    const result = lastResults;
    await navigator.share({
      title: exportBaseName(result.source) + " " + t("识别结果"),
      text: plainTextResult()
    });
    if (lastResults === result) {
      setStatus(() => t("已分享 {0} 行文本。", resultLineCount(result)));
    }
  }
  function exportTxt() {
    if (!lastResults) return;
    const text = plainTextResult();
    downloadResult(text ? text + "\n" : "", "text/plain;charset=utf-8", ".txt");
    setStatus(() => t("已导出 {0} 行 {1}。", resultLineCount(), "TXT"));
  }
  function exportJson() {
    if (!lastResults) return;
    downloadResult(JSON.stringify(lastResults, null, 2) + "\n",
      "application/json;charset=utf-8", ".json");
    setStatus(() => t("已导出 {0} 行 {1}。", resultLineCount(), "JSON"));
  }
  function setMobilePanel(panel) {
    workspace.dataset.mobilePanel = panel;
    const showingImage = panel === "image";
    showImageButton.classList.toggle("active", showingImage);
    showResultsButton.classList.toggle("active", !showingImage);
    showImageButton.setAttribute("aria-pressed", String(showingImage));
    showResultsButton.setAttribute("aria-pressed", String(!showingImage));
  }
  function drawPreview(image, width, height) {
    endPreviewPan();
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    overlay.setAttribute("viewBox", "0 0 " + width + " " + height);
    overlay.replaceChildren();
    applyZoom();
  }
  function drawResults(lines, width, height, xScale = 1, yScale = 1) {
    const namespace = "http://www.w3.org/2000/svg";
    overlay.setAttribute("viewBox", "0 0 " + width + " " + height);
    overlay.replaceChildren();
    lines.forEach((line, index) => {
      const box = line.box.map((coordinate, coordinateIndex) =>
        coordinate * (coordinateIndex % 2 ? yScale : xScale));
      const polygon = document.createElementNS(namespace, "polygon");
      polygon.dataset.lineIndex = String(index);
      polygon.setAttribute("points", [
        box[0] + "," + box[1], box[2] + "," + box[3],
        box[4] + "," + box[5], box[6] + "," + box[7]
      ].join(" "));
      polygon.setAttribute("stroke-width", String(Math.max(2, width / 500)));
      overlay.appendChild(polygon);
      const label = document.createElementNS(namespace, "text");
      label.setAttribute("x", String(box[0]));
      label.setAttribute("y", String(Math.max(16, box[1] - 3)));
      label.textContent = line.text;
      overlay.appendChild(label);
    });
  }
  function selectResultLine(index) {
    for (const node of resultsNode.querySelectorAll("[data-line-index]")) {
      node.classList.toggle("active", Number(node.dataset.lineIndex) === index);
    }
    for (const node of overlay.querySelectorAll("[data-line-index]")) {
      node.classList.toggle("active", Number(node.dataset.lineIndex) === index);
    }
  }
  function renderResults(lines, pageNumber = null, pageCount = null) {
    const heading = pageNumber === null ? "" :
      '<div class="page-heading">' + t('页码', pageNumber, pageCount) + '</div>';
    resultsNode.innerHTML = heading + (lines.length ? lines.map((line, index) =>
      '<div class="line" data-line-index="' + index + '"><div class="index">' +
      String(index + 1).padStart(2, "0") + '</div><div class="text"><b>' +
      escapeHtml(line.text) + '</b><div class="score">' +
      (line.source === "text-layer" ? t("PDF 文字层 · 置信度不适用") :
        t("OCR 行级识别 ") + (Number.isFinite(line.rec_score) ? (line.rec_score * 100).toFixed(1) + "%" : t("分数不可用"))) + "</div></div></div>"
    ).join("") : '<div class="empty">' + t("未检测到文本。") + '</div>');
  }

  function findPdfPageResult(pageNumber) {
    return lastResults && lastResults.schema_version === 2 ?
      lastResults.pages.find(page => page.page_number === pageNumber) || null : null;
  }
  function renderPdfResultView() {
    if (!source || source.kind !== "pdf" || !lastResults || lastResults.schema_version !== 2) {
      return;
    }
    pdfResultTabs.hidden = false;
    const pageMode = pdfResultView === "page";
    showPageResultButton.classList.toggle("active", pageMode);
    showFullResultButton.classList.toggle("active", !pageMode);
    if (!pageMode) {
      resultsNode.innerHTML = '<div class="full-text">' + escapeHtml(plainTextResult()) + "</div>";
      return;
    }
    const page = findPdfPageResult(source.currentPage);
    renderResults(page ? page.lines : [], source.currentPage, source.pageCount);
  }
  async function decodeImagePreview(file) {
    const started = performance.now();
    let image;
    let close = null;
    if (window.createImageBitmap) {
      image = await createImageBitmap(file);
      close = image.close ? () => image.close() : null;
    } else {
      const url = URL.createObjectURL(file);
      try {
        image = new Image();
        image.decoding = "async";
        image.src = url;
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    try {
      originalWidth = image.width || image.naturalWidth;
      originalHeight = image.height || image.naturalHeight;
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(originalWidth, originalHeight));
      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));
      drawPreview(image, width, height);
      preparedSource = canvas;
      prepareMilliseconds = performance.now() - started;
      prepareCount += 1;
      return {width, height};
    } finally {
      if (close) close();
    }
  }
  function updatePdfControls() {
    const pdf = source && source.kind === "pdf" ? source : null;
    pdfControls.hidden = !pdf;
    updatePreviewControls(pdf);
    previewTitle.textContent = pdf ? t("PDF 页面预览") : t("图像预览");
    if (!pdf) return;
    pdfMeta.textContent = t("{0} · {1} 页", pdf.file.name || "document.pdf", pdf.pageCount);
    pdfPageLabel.textContent = pdf.currentPage + " / " + pdf.pageCount;
    pdfPrev.disabled = running || pdfPreviewRunning || pdf.currentPage <= 1;
    pdfNext.disabled = running || pdfPreviewRunning || pdf.currentPage >= pdf.pageCount;
    pdfScope.disabled = running;
    pdfDpi.disabled = running;
    pdfMode.disabled = running;
  }
  async function renderPdfPreview(pageNumber) {
    if (!source || source.kind !== "pdf" || pdfPreviewRunning) return;
    const pdfSource = source;
    const sequence = ++previewSequence;
    pdfPreviewRunning = true;
    pdfSource.currentPage = pageNumber;
    updatePdfControls();
    runButton.disabled = true;
    setStatus(() => t("正在渲染第 {0} / {1} 页预览…", pageNumber, pdfSource.pageCount));
    let rendered = null;
    try {
      rendered = await pdfSource.document.renderPage(pageNumber, {
        dpi: PDF_PREVIEW_DPI,
        maxPixels: PDF_PREVIEW_MAX_PIXELS
      });
      if (sequence !== previewSequence || source !== pdfSource) return;
      drawPreview(rendered.canvas, rendered.width, rendered.height);
      const pageResult = findPdfPageResult(pageNumber);
      if (pageResult) {
        drawResults(pageResult.lines, rendered.width, rendered.height,
          rendered.width / pageResult.image.width,
          rendered.height / pageResult.image.height);
      }
      renderPdfResultView();
      drawSearchHighlights();
      const compatibility = pdfStatus() &&
        pdfStatus().worker_backend === "main-thread" ? " · PDF 兼容模式" : "";
      setStatus(() => pageResult ?
        t("第 {0} 页已识别，共 {1} 行{2}。", pageNumber, pageResult.lines.length, t(compatibility)) :
        t("PDF 已准备好") + t(compatibility) + t("，点击“开始识别”。"));
    } catch (error) {
      if (!(error && error.code === "LW_PDF_CANCELLED")) throw error;
    } finally {
      if (rendered) rendered.release();
      pdfPreviewRunning = false;
      runButton.disabled = !(engine && source) || running;
      updatePdfControls();
    }
  }
  async function disposeSource(oldSource) {
    if (oldSource && oldSource.kind === "pdf") {
      oldSource.cancelled = true;
      oldSource.document.cancelRender();
      await oldSource.document.close();
    }
  }
  async function selectFile(file) {
    if (running) return null;
    endPreviewPan();
    const sequence = ++previewSequence;
    closePreview();
    zoom = 1; fitPreview = true;
    latestProgress = null; pdfProgress.hidden = true;
    const previous = source;
    source = null;
    preparedSource = null;
    clearLastResults();
    clearPdfDiagnostics();
    runButton.disabled = true;
    setMobilePanel("image");
    updatePdfControls();
    await disposeSource(previous);
    if (!file) {
      setStatus(() => t("就绪，请选择图片或 PDF。"));
      resultsNode.innerHTML = '<div class="empty" data-i18n="选择文件后，这里会显示识别文本。">' + t("选择文件后，这里会显示识别文本。") + '</div>';
      return null;
    }
    if (sourceKind(file) === "image") {
      try {
        setStatus(() => t("正在准备图片…"));
        const prepared = await decodeImagePreview(file);
        if (sequence !== previewSequence) return null;
        source = {
          kind: "image",
          file,
          preparedCanvas: canvas,
          originalWidth,
          originalHeight
        };
        updatePdfControls();
        resultsNode.innerHTML = '<div class="empty" data-i18n="图片已准备好，点击“开始识别”执行 OCR。">' + t("图片已准备好，点击“开始识别”执行 OCR。") + '</div>';
        setStatus(() => t("已选择：{0} · {1}×{2}，点击“开始识别”。", file.name || "image", prepared.width, prepared.height));
        runButton.disabled = !engine;
        return preparedSource;
      } catch (error) {
        if (sequence === previewSequence) {
          source = null;
          preparedSource = null;
          setStatus(() => t("图片预览失败：") + error);
        }
        throw error;
      }
    }
    if (!window.LwPdf) {
      setStatus(() => t("当前 HTML 构建未包含 PDF 支持。"));
      throw new Error("PDF support is disabled");
    }
    const started = performance.now();
    setStatus(() => t("正在打开 PDF…"));
    let documentHandle = null;
    try {
      documentHandle = await LwPdf.open(file);
      if (sequence !== previewSequence) {
        await documentHandle.close();
        return null;
      }
      prepareMilliseconds = performance.now() - started;
      prepareCount += 1;
      source = {
        kind: "pdf",
        file,
        document: documentHandle,
        pageCount: documentHandle.pageCount,
        currentPage: 1,
        cancelled: false,
        pdfLoadMilliseconds: prepareMilliseconds
      };
      updatePdfControls();
      resultsNode.innerHTML = '<div class="empty" data-i18n="PDF 已准备好，点击“开始识别”执行 OCR。">' + t("PDF 已准备好，点击“开始识别”执行 OCR。") + '</div>';
      await renderPdfPreview(1);
      runButton.disabled = !engine;
      return source;
    } catch (error) {
      if (documentHandle) {
        try {
          await documentHandle.close();
        } catch (_) {
          // Keep the original open/render error as the user-visible failure.
        }
      }
      if (sequence === previewSequence) {
        source = null;
        updatePdfControls();
        const message = pdfErrorMessage(error);
        const diagnostics = showPdfDiagnostics(error);
        setStatus(() => pdfErrorMessage(error));
        document.dispatchEvent(new CustomEvent("lwppocr:error", {
          detail: {
            phase: error && error.phase ? error.phase : "pdf-open",
            code: error && error.code,
            message,
            diagnostics
          }
        }));
      }
      throw error;
    }
  }

  async function selectClipboardImage(file) {
    if (running) {
      setStatus(() => t("正在识别，请稍后再粘贴图片。"));
      return null;
    }
    const normalized = normalizeClipboardImage(file);
    const result = await selectFile(normalized);
    if (result && source && source.kind === "image") {
      setStatus(() => t("已从剪贴板加载图片 · {0}×{1}，点击“开始识别”。", source.originalWidth, source.originalHeight));
    }
    return result;
  }

  function handlePaste(event) {
    const file = clipboardImageFile(event);
    if (!file) return;
    event.preventDefault();
    selectClipboardImage(file).catch(error => {
      setStatus(() => t("剪贴板图片预览失败：") + error);
    });
  }

  function adaptImageResult(result) {
    const imageSource = source;
    const xScale = imageSource.originalWidth / result.image.width;
    const yScale = imageSource.originalHeight / result.image.height;
    return {
      schema_version: 1,
      source: imageSource.file.name || result.source,
      image: {width: imageSource.originalWidth, height: imageSource.originalHeight},
      options: result.options,
      elapsed_ms: 0,
      lines: result.lines.map(line => ({
        ...line,
        box: line.box.map((coordinate, index) =>
          coordinate * (index % 2 ? yScale : xScale))
      }))
    };
  }
  function adaptPdfPageResult(pageNumber, rendered, result, renderMilliseconds) {
    const xScale = rendered.width / result.image.width;
    const yScale = rendered.height / result.image.height;
    const lines = result.lines.map(line => {
      const box = line.box.map((coordinate, index) =>
        coordinate * (index % 2 ? yScale : xScale));
      const pdfBox = [];
      for (let index = 0; index < box.length; index += 2) {
        const point = rendered.toPdfPoint(box[index], box[index + 1]);
        pdfBox.push(Number(point[0].toFixed(3)), Number(point[1].toFixed(3)));
      }
      return {...line, box, pdf_box: pdfBox};
    });
    return {
      page_number: pageNumber,
      pdf: {
        width_pt: Number(rendered.pdfWidth.toFixed(3)),
        height_pt: Number(rendered.pdfHeight.toFixed(3)),
        rotation: rendered.rotation
      },
      image: {width: rendered.width, height: rendered.height},
      timing: {
        render_ms: Number(renderMilliseconds.toFixed(3)),
        inference_ms: Number(result.timing.total_ms.toFixed(3)),
        total_ms: 0
      },
      lines
    };
  }
  let latestStatsResult = null;
  function updateStats(status, result) {
    latestStatsResult = result || null;
    if (source && source.kind === "pdf" && lastResults && lastResults.schema_version === 2) {
      const timing = lastResults.timing;
      statsNode.textContent = t("统计PDF", lastResults.document.processed_pages, lastResults.document.page_count,
        resultLineCount(), timing.pdf_load_ms.toFixed(0), timing.render_ms.toFixed(0),
        timing.inference_ms.toFixed(0), timing.total_ms.toFixed(0));
    } else if (result) {
      statsNode.textContent = t("统计图片", runCount, t(status.backend === "worker" ? "后台线程" : "兼容模式"),
        prepareMilliseconds.toFixed(0), result.timing.inference_ms.toFixed(0), result.timing.total_ms.toFixed(0),
        t(result.options.use_cls ? "开启" : "关"));
    } else {
      statsNode.textContent = t("统计就绪", t(status.backend === "worker" ? "后台线程" : "兼容模式"),
        status.maxLineCapacity, status.maxTextCapacity, t(clsInput.checked ? "开启" : "关"));
    }
  }
  async function createEngine() {
    clsInput.disabled = true;
    readingOrderInput.disabled = true;
    setStatus(() => t("正在加载 WASM 和模型…"));
    if (window.__lwOcrBootStatus) {
      window.__lwOcrBootStatus.setPhase("正在初始化 WASM 和模型");
    }
    try {
      const instance = await LwPpocr.create({
        useCls: clsInput.checked,
        readingOrder: readingOrderInput.value,
        // The Demo owns image and PDF page sizing. The reusable SDK default
        // remains 1600 for third-party callers.
        maxImageSide: 0
      });
      engine = instance;
      if (window.__lwOcrBootStatus) window.__lwOcrBootStatus.finish();
      updateStats(instance.getStatus());
      runButton.disabled = !source;
      setStatus(() => source ?
        t("文件已准备好，点击“开始识别”。") : t("就绪，请选择图片或 PDF。"));
      document.dispatchEvent(new CustomEvent("lwppocr:ready", {
        detail: {backend: instance.getStatus().backend}
      }));
      return instance;
    } finally {
      clsInput.disabled = false;
      readingOrderInput.disabled = false;
    }
  }
  async function reconfigureCls() {
    if (!engine || running) return;
    runButton.disabled = true;
    engine.destroy();
    engine = null;
    enginePromise = createEngine();
    await enginePromise;
  }
  function setRunningState(value, canStop = false) {
    running = value;
    if (value) document.getElementById("status-region").open = true;
    fileInput.disabled = value;
    cameraInput.disabled = value;
    clsInput.disabled = value;
    readingOrderInput.disabled = value;
    runButton.disabled = value && !canStop;
    runButton.classList.toggle("stop", value && canStop);
    runButton.textContent = value && canStop ? t("停止") : t("开始识别");
    document.body.toggleAttribute("aria-busy", value);
    refreshSearch();
    updatePdfControls();
  }
  async function runImageOcr() {
    if (!engine || !source || source.kind !== "image" || running) return null;
    setRunningState(true);
    clearLastResults();
    updateProgress(0, 1, "processing");
    setStatus(() => t("正在识别，页面仍可正常操作…"));
    try {
      const result = await engine.recognize(source.preparedCanvas, {
        readingOrder: readingOrderInput.value
      });
      const uiStarted = performance.now();
      drawResults(result.lines, result.image.width, result.image.height);
      lastResults = adaptImageResult(result);
      refreshSearch();
      renderResults(lastResults.lines);
      setExportEnabled(true);
      updateProgress(1, 1, "complete");
      runCount += 1;
      setMobilePanel("results");
      const uiMilliseconds = performance.now() - uiStarted;
      lastTimingBreakdown = {
        prepareMilliseconds,
        sdkTotalMilliseconds: result.timing.total_ms,
        uiMilliseconds
      };
      lastResults.elapsed_ms = Number((prepareMilliseconds +
        result.timing.total_ms + uiMilliseconds).toFixed(3));
      updateStats(engine.getStatus(), result);
      setStatus(() => t("完成：{0} 行", lastResults.lines.length));
      document.dispatchEvent(new CustomEvent("lwppocr:result", {detail: lastResults}));
      return lastResults;
    } catch (error) {
      updateProgress(0, 1, "error");
      setStatus(() => t("识别失败：") + error);
      document.dispatchEvent(new CustomEvent("lwppocr:error", {
        detail: {phase: "recognize", message: String(error)}
      }));
      console.error(error);
      throw error;
    } finally {
      setRunningState(false);
      runButton.disabled = !(engine && source);
    }
  }
  async function nextAnimationFrame() {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function runPdfOcr() {
    if (!engine || !source || source.kind !== "pdf" || running || pdfPreviewRunning) return null;
    const pdfSource = source;
    pdfSource.cancelled = false;
    const pages = pdfScope.value === "current" ? [pdfSource.currentPage] :
      Array.from({length: pdfSource.pageCount}, (_, index) => index + 1);
    const dpi = Number(pdfDpi.value);
    const runStarted = performance.now();
    let renderTotal = 0;
    let inferenceTotal = 0;
    let uiTotal = 0;
    clearLastResults();
    lastResults = {
      schema_version: 2,
      source_type: "pdf",
      source: pdfSource.file.name || "document.pdf",
      document: {page_count: pdfSource.pageCount, processed_pages: 0, status:"processing"},
      options: {
        use_cls: clsInput.checked,
        reading_order: readingOrderInput.value,
        pdf_dpi: dpi,
        pdf_mode: pdfMode.value,
        pdf_max_pixels: PDF_MAX_PIXELS
      },
      timing: {
        pdf_load_ms: Number(pdfSource.pdfLoadMilliseconds.toFixed(3)),
        render_ms: 0,
        inference_ms: 0,
        ui_ms: 0,
        total_ms: 0
      },
      pages: []
    };
    pdfResultTabs.hidden = false;
    pdfResultView = "page";
    updateProgress(0, pages.length, "processing");
    setRunningState(true, true);
    setExportEnabled(false);
    try {
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        if (pdfSource.cancelled || source !== pdfSource) break;
        const pageNumber = pages[pageIndex];
        pdfSource.currentPage = pageNumber;
        updatePdfControls();
        setStatus(() => t("正在处理第 {0} / {1} 页：渲染…", pageNumber, pdfSource.pageCount));
        let rendered = null;
        try {
          const renderStarted = performance.now();
          rendered = await pdfSource.document.renderPage(pageNumber, {
            dpi,
            maxPixels: PDF_MAX_PIXELS
          });
          const renderMilliseconds = performance.now() - renderStarted;
          renderTotal += renderMilliseconds;
          if (pdfSource.cancelled || source !== pdfSource) break;
          setStatus(() => t("正在处理第 {0} / {1} 页：读取文字 / OCR…", pageNumber, pdfSource.pageCount));
          const mode = lastResults.options.pdf_mode;
          let textLines = [], textError = null;
          if (mode !== "ocr") {
            try { textLines = await rendered.extractText(); }
            catch (error) { textError = String(error); if (mode === "text") throw error; }
          }
          const needsOcr = mode === "ocr" || (mode === "auto" &&
            (!textLines.length || textLines.unreliable || await rendered.hasRasterImages()));
          const ocrResult = needsOcr ? await engine.recognize(rendered.canvas, {
            readingOrder: readingOrderInput.value
          }) : {image:{width:rendered.width,height:rendered.height}, lines:[], timing:{total_ms:0}};
          inferenceTotal += ocrResult.timing.total_ms;
          if (source !== pdfSource) break;
          const uiStarted = performance.now();
          const pageResult = adaptPdfPageResult(
            pageNumber, rendered, ocrResult, renderMilliseconds);
          pageResult.lines = LwPdfSearch.mergeLines(textLines, pageResult.lines);
          pageResult.processing_source = needsOcr ? (textLines.length ? "mixed" : "ocr") : "text-layer";
          if (textError) pageResult.text_layer_warning = textError;
          drawPreview(rendered.canvas, rendered.width, rendered.height);
          drawResults(pageResult.lines, rendered.width, rendered.height);
          pageResult.timing.total_ms = Number((renderMilliseconds +
            ocrResult.timing.total_ms).toFixed(3));
          lastResults.pages.push(pageResult);
          lastResults.document.processed_pages = lastResults.pages.length;
          refreshSearch();
          pdfResultView = "page";
          renderPdfResultView();
          uiTotal += performance.now() - uiStarted;
          lastResults.timing.render_ms = Number(renderTotal.toFixed(3));
          lastResults.timing.inference_ms = Number(inferenceTotal.toFixed(3));
          lastResults.timing.ui_ms = Number(uiTotal.toFixed(3));
          lastResults.timing.total_ms = Number((pdfSource.pdfLoadMilliseconds +
            renderTotal + inferenceTotal + uiTotal).toFixed(3));
          setExportEnabled(true);
          updateProgress(pageIndex + 1, pages.length, "processing");
          updateStats(engine.getStatus());
          await nextAnimationFrame();
        } catch (error) {
          if (pdfSource.cancelled && error && error.code === "LW_PDF_CANCELLED") break;
          throw error;
        } finally {
          if (rendered) rendered.release();
        }
      }
      runCount += 1;
      setMobilePanel("results");
      lastResults.timing.total_ms = Number((pdfSource.pdfLoadMilliseconds +
        performance.now() - runStarted).toFixed(3));
      lastTimingBreakdown = JSON.parse(JSON.stringify(lastResults.timing));
      const stopped = pdfSource.cancelled;
      updateProgress(lastResults.pages.length, pages.length, stopped ? "stopped" : "complete");
      lastResults.document.status = stopped ? "stopped" :
        lastResults.pages.length === pdfSource.pageCount ? "complete" : "partial";
      refreshSearch();
      const completedCount = lastResults.document.processed_pages;
      const lineCount = resultLineCount();
      setStatus(() => stopped ?
        t("已停止：完成 {0} / {1} 页。", completedCount, pdfSource.pageCount) :
        t("完成：{0} 页，共 {1} 行。", completedCount, lineCount));
      if (lastResults.pages.length) {
        document.dispatchEvent(new CustomEvent("lwppocr:result", {detail: lastResults}));
      } else {
        clearLastResults();
      }
      return lastResults;
    } catch (error) {
      updateProgress(lastResults ? lastResults.pages.length : 0, pages.length, "error");
      if (lastResults) { lastResults.document.status = "error"; refreshSearch(); }
      setStatus(() => t("PDF 识别失败：") + error);
      document.dispatchEvent(new CustomEvent("lwppocr:error", {
        detail: {phase: "pdf-recognize", code: error && error.code, message: String(error)}
      }));
      console.error(error);
      throw error;
    } finally {
      setRunningState(false);
      runButton.disabled = !(engine && source);
      updatePdfControls();
    }
  }
  async function runOcr() {
    if (!source) return null;
    return source.kind === "pdf" ? runPdfOcr() : runImageOcr();
  }
  function cancelPdfOcr() {
    if (!running || !source || source.kind !== "pdf") return;
    source.cancelled = true;
    source.document.cancelRender();
    runButton.disabled = true;
    setStatus(() => t("正在停止；若当前页已进入 OCR，将在本页完成后停止…"));
  }
  async function navigatePdf(delta) {
    if (!source || source.kind !== "pdf" || running || pdfPreviewRunning) return;
    const pageNumber = Math.max(1, Math.min(source.pageCount, source.currentPage + delta));
    if (pageNumber !== source.currentPage) await renderPdfPreview(pageNumber);
  }
  function snapshot() {
    const status = engine ? engine.getStatus() : {ready: false, backend: "loading"};
    const pdf = source && source.kind === "pdf" ? source : null;
    const documentStatus = pdfStatus();
    return {
      ...status,
      ready: Boolean(engine && status.ready),
      runCount,
      prepareCount,
      prepared: Boolean(source && (preparedSource || pdf)),
      sourceKind: source ? source.kind : null,
      pdfPageCount: pdf ? pdf.pageCount : 0,
      pdfCurrentPage: pdf ? pdf.currentPage : 0,
      pdfWorkerBackend: documentStatus ? documentStatus.worker_backend : null,
      overlayVisible,
      pdfErrorCode: documentStatus && documentStatus.last_error ?
        documentStatus.last_error.code : null,
      processedPages: lastResults && lastResults.schema_version === 2 ?
        lastResults.document.processed_pages : 0,
      hasResults: Boolean(lastResults),
      exportEnabled: exportButtons.every(button => !button.disabled)
    };
  }


  function currentSearchOptions() {
    return {caseSensitive:searchCase.checked, ignoreWhitespace:searchSpaces.checked};
  }
  function searchablePages() {
    if (!lastResults) return [];
    return lastResults.schema_version === 2 ? lastResults.pages :
      [{page_number:1,image:lastResults.image,lines:lastResults.lines}];
  }
  function matchLabel(hit) {
    return hit.confidence === null ? (hit.source === "text-layer" ?
      t("文字层匹配 · 置信度不适用") : t("OCR 分数不可用")) :
      t("OCR 行级置信度 ") + (hit.confidence*100).toFixed(1) + "%" +
      (hit.line_indices.length > 1 ? t("（相关行最低分）") : "");
  }
  function drawSearchHighlights() {
    const terms = LwPdfSearch.queries(searchInput.value, currentSearchOptions());
    if (!terms.length) {
      const page = source && source.kind === "pdf" ? findPdfPageResult(source.currentPage) :
        searchablePages()[0];
      if (page) drawResults(page.lines, canvas.width, canvas.height,
        canvas.width/page.image.width, canvas.height/page.image.height);
      return;
    }
    overlay.replaceChildren();
    if (!lastResults || !lastResults.search) return;
    const pageNumber = source && source.kind === "pdf" ? source.currentPage : 1;
    const page = searchablePages().find(p=>p.page_number === pageNumber);
    if (!page) return;
    const ns = "http://www.w3.org/2000/svg";
    overlay.setAttribute("viewBox", "0 0 " + canvas.width + " " + canvas.height);
    lastResults.search.results.forEach((summary,qi) => summary.matches.forEach((hit,hi) => {
      if (hit.page_number !== pageNumber) return;
      const active = selectedMatch && selectedMatch.qi === qi && selectedMatch.hi === hi;
      hit.boxes.forEach(box => {
        const points = [];
        for (let i=0;i<8;i+=2) points.push((box[i]*canvas.width/page.image.width) + "," +
          (box[i+1]*canvas.height/page.image.height));
        const polygon = document.createElementNS(ns,"polygon");
        polygon.setAttribute("points",points.join(" "));
        polygon.setAttribute("class","search-hit" + (active ? " active" : ""));
        polygon.dataset.queryIndex = String(qi);
        const title = document.createElementNS(ns,"title");
        title.textContent = hit.query + t(" · 第 ") + hit.occurrence + t(" 处 · ") + matchLabel(hit);
        polygon.appendChild(title); overlay.appendChild(polygon);
        if (active) {
          const label = document.createElementNS(ns,"text");
          label.setAttribute("x",String(box[0]*canvas.width/page.image.width));
          label.setAttribute("y",String(Math.max(16,box[1]*canvas.height/page.image.height-5)));
          label.textContent = hit.query + " · " + matchLabel(hit);
          overlay.appendChild(label);
        }
      });
    }));
  }
  function refreshSearch() {
    const options = currentSearchOptions();
    const terms = LwPdfSearch.queries(searchInput.value, options);
    const pages = searchablePages();
    const count = source && source.kind === "pdf" ? source.pageCount : 1;
    const complete = Boolean(lastResults && (lastResults.schema_version !== 2 ||
      lastResults.document.status === "complete"));
    searchSummary.hidden = !terms.length;
    const queryOpen = new Map(Array.from(searchResultsNode.children, node => [node.dataset.query, node.open]));
    searchResultsNode.replaceChildren();
    const results = LwPdfSearch.search(pages, terms, options);
    if (lastResults) lastResults.search = {schema_version:1, options, complete,
      processed_pages:pages.map(p=>p.page_number), page_count:count, results};
    searchCoverage.textContent = !lastResults ? t("等待识别 · {0} 个字符串", terms.length) :
      t("已检查 {0} / {1} 页 · ", pages.length, count) +
      (complete ? t("全部页面已完成") : t("结果尚不完整，未处理页面尚未检查")) +
      (lastResults.options && lastResults.options.pdf_mode === "text" ? t(" · 仅检索文字层，未检查扫描图") : "") +
      t(" · OCR 分数来自模型，不能视为正确率保证。");
    results.forEach((result,qi) => {
      const details = document.createElement("details");
      details.className = "query-result"; details.dataset.query = result.query;
      details.open = queryOpen.get(result.query) !== false;
      const heading = document.createElement("summary");
      heading.textContent = result.query + " — " + (result.count ?
        t("{0} 处 / {1} 页", result.count, result.pages.length) :
        !lastResults ? t("待检查") : complete ? t("未找到") : t("已检查页面未找到"));
      if (!result.count) heading.className = "not-found";
      details.appendChild(heading);
      for (const page of result.pages) {
        const label = document.createElement("p"); label.className = "query-page";
        label.textContent = t("第 {0} 页 · {1} 处", page.page_number, page.count);
        details.appendChild(label);
        result.matches.forEach((hit,hi) => {
          if (hit.page_number !== page.page_number) return;
          const button = document.createElement("button"); button.type = "button";
          button.className = "query-hit"; button.disabled = running;
          button.classList.toggle("active", !!selectedMatch && selectedMatch.qi === qi && selectedMatch.hi === hi);
          button.textContent = t("第 {0} 处 · {1}", hit.occurrence, matchLabel(hit)) + "\n" + hit.context;
          button.addEventListener("click", async () => {
            if (running || pdfPreviewRunning) return;
            selectedMatch = {qi,hi};
            try {
              if (source && source.kind === "pdf" && source.currentPage !== hit.page_number)
                await renderPdfPreview(hit.page_number);
              setMobilePanel("image"); setRegionOpen("preview", true); setOverlayVisible(true); drawSearchHighlights();
              searchResultsNode.querySelectorAll(".query-hit").forEach(b=>b.classList.remove("active"));
              button.classList.add("active");
              canvas.scrollIntoView({behavior:"smooth",block:"center"});
              setStatus(() => t("第 {0} 页 · {1} · {2}", hit.page_number, hit.query, matchLabel(hit)));
            } catch (error) { setStatus(() => t("定位失败：") + error); }
          });
          details.appendChild(button);
        });
      }
      searchResultsNode.appendChild(details);
    });
    drawSearchHighlights();
  }
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer); searchTimer = setTimeout(() => { selectedMatch=null; refreshSearch(); }, 180);
  });
  [searchCase,searchSpaces].forEach(input=>input.addEventListener("change",()=> {
    selectedMatch=null; refreshSearch();
  }));

  fileInput.addEventListener("change", event =>
    selectFile(event.target.files[0] || null).catch(() => {}));
  cameraInput.addEventListener("change", event =>
    selectFile(event.target.files[0] || null).catch(() => {}));
  clsInput.addEventListener("change", () => reconfigureCls().catch(error => {
    setStatus(() => t("切换 CLS 失败：") + error);
  }));
  ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove("drag");
  }));
  dropzone.addEventListener("drop", event => {
    if (event.dataTransfer.files.length) {
      selectFile(event.dataTransfer.files[0]).catch(() => {});
    }
  });
  document.addEventListener("paste", handlePaste);
  runButton.addEventListener("click", () => {
    if (running) cancelPdfOcr();
    else runOcr().catch(() => {});
  });
  pdfPrev.addEventListener("click", () => navigatePdf(-1).catch(console.error));
  pdfNext.addEventListener("click", () => navigatePdf(1).catch(console.error));
  copyTextButton.addEventListener("click", () => copyPlainText().catch(error => {
    setStatus(() => t("复制失败：") + error);
  }));
  shareResultButton.addEventListener("click", () => shareResult().catch(error => {
    if (error.name !== "AbortError") setStatus(() => t("分享失败：") + error);
  }));
  exportTxtButton.addEventListener("click", exportTxt);
  exportJsonButton.addEventListener("click", exportJson);
  toggleOverlayButton.addEventListener("click", () => setOverlayVisible(!overlayVisible));
  copyPdfDiagnosticsButton.addEventListener("click", () =>
    copyTextValue(pdfDiagnosticsText.textContent).then(() => {
      setStatus(() => t("PDF 诊断信息已复制。"));
    }).catch(error => {
      setStatus(() => t("复制诊断信息失败：") + error);
    }));
  showImageButton.addEventListener("click", () => setMobilePanel("image"));
  showResultsButton.addEventListener("click", () => setMobilePanel("results"));
  showPageResultButton.addEventListener("click", () => {
    pdfResultView = "page";
    renderPdfResultView();
  });
  showFullResultButton.addEventListener("click", () => {
    pdfResultView = "full";
    renderPdfResultView();
  });
  resultsNode.addEventListener("click", event => {
    const line = event.target.closest("[data-line-index]");
    if (line) selectResultLine(Number(line.dataset.lineIndex));
  });
  shareResultButton.hidden = !navigator.share;

  // Compatibility adapter for existing image-only Demo automation. PDF support
  // remains a UI/document-frontend feature and does not change this v1 API.
  window.lwPpocrDemo = Object.freeze({
    apiVersion: 1,
    ready: async () => {
      await enginePromise;
      if (!engine) throw new Error(t("OCR 引擎初始化失败"));
    },
    selectImage: async file => {
      if (file && sourceKind(file) !== "image") {
        throw new LwPpocr.Error(t("selectImage() 仅接受图片"), "LW_OCR_DECODE", "decode");
      }
      return selectFile(file);
    },
    recognize: async (file, options = {}) => {
      await window.lwPpocrDemo.ready();
      if (running) {
        throw new LwPpocr.Error(t("OCR 实例正忙，请等待当前识别完成"), "LW_OCR_BUSY", "busy");
      }
      if (file && sourceKind(file) !== "image") {
        throw new LwPpocr.Error(t("recognize() 仅接受图片"), "LW_OCR_DECODE", "decode");
      }
      if (typeof options.useCls === "boolean" && options.useCls !== clsInput.checked) {
        clsInput.checked = options.useCls;
        await reconfigureCls();
      }
      if (typeof options.readingOrder === "string") {
        readingOrderInput.value = options.readingOrder;
      }
      if (file) await selectFile(file);
      if (!source || source.kind !== "image" || !preparedSource) {
        throw new LwPpocr.Error(t("请先选择图片"), "LW_OCR_INPUT_REQUIRED", "decode");
      }
      return runImageOcr();
    },
    getResult: () => lastResults ? JSON.parse(JSON.stringify(lastResults)) : null,
    getPlainText: plainTextResult,
    getStatus: snapshot
  });
  window.__lwOcrTest = {
    snapshot,
    plainTextResult,
    structuredResult: () => lastResults,
    timingBreakdown: () => lastTimingBreakdown ?
      JSON.parse(JSON.stringify(lastTimingBreakdown)) : null,
    pdfStatus: () => pdfStatus(),
    selectFile,
    selectClipboardImage,
    handlePaste,
    runOcr,
    cancelPdfOcr,
    refreshSearch,
    renderPdfPreview,
    openPreview,
    closePreview,
    changeZoom
  };
  window.addEventListener("beforeunload", () => {
    if (source && source.kind === "pdf") source.document.close();
    if (engine) engine.destroy();
    if (window.LwPdf) LwPdf.dispose();
  });
  enginePromise = createEngine().catch(error => {
    engine = null;
    if (window.__lwOcrBootStatus) window.__lwOcrBootStatus.finish();
    statsNode.textContent = t("引擎加载失败");
    statsNode.dataset.i18n = "引擎加载失败";
    setStatus(() => t("WASM 初始化失败：") + error);
    document.dispatchEvent(new CustomEvent("lwppocr:error", {
      detail: {phase: "initialize", message: String(error)}
    }));
    console.error(error);
  });
})();
