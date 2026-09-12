/* PDF 内容方向判断。返回相对于 PDF 已有 Rotate 元数据的顺时针校正角。 */
(function(root) {
  "use strict";
  const quarter = angle => ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  function fromText(lines) {
    const votes = new Map();
    let total = 0;
    for (const line of lines || []) {
      if (line.direction === "ttb" || !line.box) continue;
      const length = Array.from(line.text.replace(/\s/gu, "")).length;
      const [x,y,x2,y2] = line.box;
      const angle = Math.atan2(y2-y, x2-x) * 180 / Math.PI;
      if (!Number.isFinite(angle)) continue;
      const rotation = quarter(-angle);
      votes.set(rotation, (votes.get(rotation) || 0) + length); total += length;
    }
    const best = [...votes].sort((a,b)=>b[1]-a[1])[0];
    return total >= 8 && best && best[1]/total >= .75 ?
      {rotation:best[0],method:"text-layer",support:best[1]/total} : null;
  }
  function score(lines) {
    let value = 0, characters = 0;
    for (const line of lines || []) {
      const n = (line.text.match(/[\p{L}\p{N}]/gu) || []).length;
      const confidence = line.rec_score;
      if (n < 3 || !Number.isFinite(confidence) || confidence < .5) continue;
      const xs = line.box.filter((_,i)=>i%2===0), ys = line.box.filter((_,i)=>i%2===1);
      // PP-OCR 会自动转正单条竖向裁剪；这些框不能作为页面已经正向的证据。
      const horizontal = Math.max(...xs)-Math.min(...xs) >= Math.max(...ys)-Math.min(...ys);
      const weight = horizontal ? 1 : .08;
      value += n * Math.pow(confidence,3) * weight;
      characters += n * weight;
    }
    return {score:value,characters};
  }
  function choose(candidates) {
    const sorted = [...candidates].sort((a,b)=>b.score-a.score || a.rotation-b.rotation);
    const [best,second] = sorted;
    const margin = best ? (best.score-(second?.score || 0))/Math.max(1,best.score) : 0;
    if (!best || best.characters < 20 || best.score < 8 || margin < .12)
      return {rotation:0,method:"uncertain",margin};
    return {rotation:best.rotation,method:"ocr-probe",margin};
  }
  function rotatedThumbnail(source, angle, maxSide=1600) {
    const scale = Math.min(1,maxSide/Math.max(source.width,source.height));
    const width = Math.max(1,Math.round(source.width*scale));
    const height = Math.max(1,Math.round(source.height*scale));
    const canvas = document.createElement("canvas");
    canvas.width = angle%180 ? height : width; canvas.height = angle%180 ? width : height;
    const ctx = canvas.getContext("2d",{alpha:false});
    ctx.translate(canvas.width/2,canvas.height/2); ctx.rotate(angle*Math.PI/180);
    ctx.drawImage(source,-width/2,-height/2,width,height);
    return canvas;
  }
  async function detect(rendered, recognize, cancelled=()=>false) {
    const started = performance.now();
    function checkCancelled() {
      if (cancelled()) {
        const error = new Error("PDF orientation check cancelled");
        error.code = "LW_PDF_CANCELLED";
        throw error;
      }
    }
    checkCancelled();
    let lines = [];
    try { lines = await rendered.extractText(); } catch (_) { /* 无效文字层按扫描件判断。 */ }
    checkCancelled();
    const textDirection = lines.unreliable ? null : fromText(lines);
    if (textDirection) return {...textDirection,elapsed_ms:performance.now()-started};
    if (lines.some(line=>line.direction === "ttb")) return {rotation:0,method:"vertical-text"};
    const candidates = [];
    for (const rotation of [0,90,180,270]) {
      checkCancelled();
      const canvas = rotatedThumbnail(rendered.canvas,rotation);
      try {
        const result = await recognize(canvas);
        checkCancelled();
        candidates.push({rotation,...score(result.lines)});
      }
      finally { canvas.width=1; canvas.height=1; }
    }
    return {...choose(candidates),candidates,elapsed_ms:performance.now()-started};
  }
  root.LwPdfOrientation = Object.freeze({fromText,score,choose,detect,rotatedThumbnail});
  if (typeof module !== "undefined") module.exports = root.LwPdfOrientation;
})(globalThis);
