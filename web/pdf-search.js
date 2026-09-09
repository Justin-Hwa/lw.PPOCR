/* 纯函数检索层；坐标保持来源粒度，绝不把行级分数伪装为字符置信度。 */
(function (global) {
  "use strict";
  function normalize(text, options = {}) {
    let value = String(text).normalize("NFKC");
    if (!options.caseSensitive) value = value.toLowerCase();
    return options.ignoreWhitespace === false ? value : value.replace(/\s/gu, "");
  }
  function queries(value, options = {}) {
    const seen = new Set();
    return String(value).split(/\r?\n/).map(x => x.trim()).filter(x => {
      const key = normalize(x, options);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function bounds(box) {
    const xs = box.filter((_, i) => i % 2 === 0), ys = box.filter((_, i) => i % 2);
    return {x: Math.min(...xs), y: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys)};
  }
  function overlap(a, b) {
    const x = bounds(a), y = bounds(b);
    const area = Math.max(0, Math.min(x.r, y.r) - Math.max(x.x, y.x)) *
      Math.max(0, Math.min(x.b, y.b) - Math.max(x.y, y.y));
    return area / Math.max(1, Math.min((x.r-x.x)*(x.b-x.y), (y.r-y.x)*(y.b-y.y)));
  }
  function mergeLines(textLines, ocrLines) {
    if (!textLines.length) return ocrLines.map(line=>({...line,source:"ocr"}));
    const extra = ocrLines.filter(line => {
      const text = normalize(line.text);
      // 合并同一位置由多个 PDF 文本片段组成的重复 OCR 行。
      const candidates = textLines.filter(t => overlap(line.box, t.box) >= 0.55);
      const joined = normalize(candidates.map(t => t.text).join(""));
      return !(text && joined && (joined.includes(text) ||
        (candidates.length === 1 && text === joined)));
    }).map(line => ({...line, source: "ocr"}));
    const lines = [...textLines, ...extra];
    // 横排按视觉行分组；保留行内 x 顺序，避免不稳定的近似排序比较器。
    const rows = [];
    for (const line of lines.sort((a,b) => bounds(a.box).y - bounds(b.box).y)) {
      const b = bounds(line.box), h = Math.max(1, b.b-b.y);
      let row = rows.find(r => Math.abs(r.y - b.y) <= Math.min(r.h,h)*0.4);
      if (!row) { row = {y:b.y,h,lines:[]}; rows.push(row); }
      row.lines.push(line);
    }
    return rows.flatMap(row => row.lines.sort((a,b) => bounds(a.box).x-bounds(b.box).x));
  }
  function search(pages, terms, options = {}) {
    const summaries = terms.map(query => ({query, count:0, pages:[], matches:[]}));
    for (const page of pages) {
      // UTF-16 索引与 indexOf 一致；规范化后每个位置映射回来源片段。
      let text = "";
      const owners = [];
      page.lines.forEach((line,index) => {
        const value = normalize(line.text, options);
        if (index) {
          const prev = page.lines[index-1], a = bounds(prev.box), b = bounds(line.box);
          const h = Math.max(1, a.b-a.y, b.b-b.y);
          const sameRow = Math.abs(a.y-b.y) < h*0.5;
          // 大列间距是硬边界，不能误把左右两栏拼成一个关键词。
          const farColumn = sameRow && b.x-a.r > h*2;
          const delimiter = farColumn ? "\u0000" :
            (options.ignoreWhitespace === false && (!sameRow || b.x-a.r > h*0.25) ? " " : "");
          text += delimiter; owners.push(...Array(delimiter.length).fill(-1));
        }
        text += value;
        for (let i=0; i<value.length; i++) owners.push(index);
      });
      summaries.forEach(summary => {
        const needle = normalize(summary.query, options);
        if (!needle || needle.includes("\u0000")) return;
        const matches = [];
        for (let offset=text.indexOf(needle); offset !== -1; offset=text.indexOf(needle, offset+1)) {
          const indices = [...new Set(owners.slice(offset,offset+needle.length))].filter(i=>i>=0);
          const lines = indices.map(i=>page.lines[i]);
          const scores = lines.filter(l=>l.source !== "text-layer").map(l=>l.rec_score);
          const score = scores.length && scores.every(s=>Number.isFinite(s) && s>=0 && s<=1) ? Math.min(...scores) : null;
          const hit = {
            page_number:page.page_number, occurrence:matches.length+1,
            query:summary.query, line_indices:indices,
            source:scores.length ? (lines.some(l=>l.source==="text-layer") ? "mixed" : "ocr") : "text-layer",
            confidence:score,
            confidence_scope:scores.length ? "minimum-matched-line-score" : "not-applicable",
            highlight_scope:"source-text-runs-or-ocr-lines",
            context:lines.map(l=>l.text).join(""),
            boxes:lines.map(l=>l.box), pdf_boxes:lines.map(l=>l.pdf_box || null)
          };
          matches.push(hit);
        }
        if (matches.length) {
          summary.pages.push({page_number:page.page_number,count:matches.length,confidences:matches.map(m=>m.confidence)});
          summary.matches.push(...matches); summary.count += matches.length;
        }
      });
    }
    return summaries;
  }
  global.LwPdfSearch = Object.freeze({normalize,queries,search,mergeLines,overlap});
  if (typeof module !== "undefined") module.exports = global.LwPdfSearch;
})(globalThis);
