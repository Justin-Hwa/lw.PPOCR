/* Pinned Tesseract.js 7 worker protocol; all code, WASM and models are embedded. */
(function (root) {
  "use strict";
  const ASSETS = __LW_THAI_ASSETS__;
  function decode(key) {
    return Uint8Array.from(atob(ASSETS[key]), c => c.charCodeAt(0));
  }
  function blobUrl(data, urls) {
    const url = URL.createObjectURL(new Blob([data], {type:"text/javascript"}));
    urls.push(url);
    return url;
  }
  function supportsSimd() {
    return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
  }
  function linesFromBlocks(blocks) {
    const lines = [];
    for (const block of blocks || []) for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = String(line.text || "").trim();
        const b = line.bbox || {};
        if (!text || ![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite) || b.x1<=b.x0 || b.y1<=b.y0) continue;
        lines.push({text, box:[b.x0,b.y0,b.x1,b.y0,b.x1,b.y1,b.x0,b.y1],
          rec_score:Number.isFinite(line.confidence) ? Math.max(0,Math.min(1,line.confidence/100)) : null,
          det_score:null, source:"ocr", ocr_engine:"tesseract-tha-eng"});
      }
    }
    return lines;
  }
  async function create() {
    const urls = [];
    const simd = supportsSimd();
    // One worker Blob also works on file:// origins that reject nested importScripts.
    // Preinstall Core with WASM bytes, so getCore never uses its CDN fallback.
    const prelude = "\nconst embeddedCore = self.TesseractCore;\n" +
      "self.TesseractCore = options => embeddedCore({...options,wasmBinary:Uint8Array.from(atob(" +
      JSON.stringify(ASSETS[simd ? "simdWasm" : "scalarWasm"]) + "), c=>c.charCodeAt(0))});\n" +
      "self.addEventListener('unhandledrejection', event => { throw event.reason; });\n";
    const workerUrl = blobUrl(new Blob([decode(simd ? "simdJs" : "scalarJs"), prelude, decode("worker")]), urls);
    let worker, sequence = 0, failure = null;
    const pending = new Map();
    function destroy(error = new Error("Thai OCR worker closed")) {
      failure = error;
      if (worker) worker.terminate();
      for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
      pending.clear();
    }
    function call(action, payload) {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        const jobId = String(++sequence);
        const timer = setTimeout(() => destroy(new Error("Thai OCR worker timed out")), 180000);
        pending.set(jobId, {resolve, reject, timer});
        try { worker.postMessage({workerId:"embedded-thai", jobId, action, payload}); }
        catch (error) { destroy(error); }
      });
    }
    try {
      worker = new Worker(workerUrl);
      worker.onmessage = ({data}) => {
        const job = pending.get(data.jobId);
        if (!job || data.status === "progress") return;
        if (data.status === "reject") { destroy(new Error(String(data.data))); return; }
        if (data.status === "resolve") {
          clearTimeout(job.timer); pending.delete(data.jobId); job.resolve(data.data);
        }
      };
      worker.onerror = event => { event.preventDefault(); destroy(new Error(event.message || "Thai OCR worker failed")); };
      worker.onmessageerror = () => destroy(new Error("Thai OCR worker message failed"));
      await call("load", {options:{lstmOnly:true}});
      await call("loadLanguage", {langs:[{code:"tha",data:decode("tha")},{code:"eng",data:decode("eng")}],
        options:{cacheMethod:"none",gzip:false,lstmOnly:true}});
      // Version 7's convenience API passes .data instead of .code to Init for custom
      // models. Separate loading and initialization to keep the upstream worker intact.
      await call("initialize", {langs:"tha+eng",oem:1,config:{}});
      await call("setParameters", {params:{preserve_interword_spaces:"1"}});
    } catch (error) {
      destroy(error);
      throw error;
    } finally {
      urls.forEach(url => URL.revokeObjectURL(url));
    }
    return {
      async recognize(canvas) {
        const start = performance.now();
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value =>
          value ? resolve(value) : reject(new Error("Unable to encode OCR image")), "image/png"));
        const data = await call("recognize", {image:new Uint8Array(await blob.arrayBuffer()),
          options:{},output:{text:true,blocks:true}});
        const milliseconds = performance.now() - start;
        return {source:"image", image:{width:canvas.width,height:canvas.height},
          options:{use_cls:false,reading_order:"horizontal-ltr",ocr_language:"tha+eng",ocr_engine:"tesseract"},
          lines:linesFromBlocks(data.blocks),
          timing:{total_ms:milliseconds,inference_ms:milliseconds}};
      },
      destroy
    };
  }
  root.LwThaiOcr = Object.freeze({create,linesFromBlocks});
})(globalThis);
