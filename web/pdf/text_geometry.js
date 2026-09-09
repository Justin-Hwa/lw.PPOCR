/* PDF 文字片段四边形：复用渲染使用的 viewport，覆盖旋转和 CropBox。 */
(function(global) {
  "use strict";
  function extract(content, viewport, util) {
    const lines = content.items.filter(item => typeof item.str === "string" &&
      item.str.trim() && !/\uFFFD/.test(item.str)).map(item => {
      const style = content.styles[item.fontName] || {};
      const tx = util.transform(viewport.transform, item.transform);
      let angle = Math.atan2(tx[1], tx[0]);
      if (style.vertical) angle += Math.PI / 2;
      const height = Math.hypot(tx[2], tx[3]);
      const ascent = (Number.isFinite(style.ascent) ? style.ascent :
        Number.isFinite(style.descent) ? 1 + style.descent : 0.8) * height;
      const length = Math.abs(style.vertical ? item.height : item.width) * viewport.scale;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const vx = -uy, vy = ux;
      const x = tx[4] - vx * ascent, y = tx[5] - vy * ascent;
      const box = [x,y,x+ux*length,y+uy*length,
        x+ux*length+vx*height,y+uy*length+vy*height,x+vx*height,y+vy*height];
      const pdfBox = [];
      for (let i=0;i<8;i+=2) pdfBox.push(...viewport.convertToPdfPoint(box[i],box[i+1]));
      return {text:item.str, box, pdf_box:pdfBox, source:"text-layer",
        rec_score:null, det_score:null, direction:item.dir, has_eol:item.hasEOL};
    }).filter(line => line.box.every(Number.isFinite));
    lines.unreliable = content.items.some(item => /\uFFFD/.test(item.str || ""));
    return lines;
  }
  global.LwPdfTextGeometry = Object.freeze({extract});
  if (typeof module !== "undefined") module.exports = global.LwPdfTextGeometry;
})(globalThis);
