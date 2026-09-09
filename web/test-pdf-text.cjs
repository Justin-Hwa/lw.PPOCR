/* Node 集成测试：真实 PDF.js 解析/渲染、内嵌 CMap/字体、旋转坐标和扫描图识别入口。 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), {pathToFileURL} = require("node:url");
const S = require("./pdf-search.js"), G = require("./pdf/text_geometry.js");
function makePdf(objects) {
 const chunks=[Buffer.from("%PDF-1.7\n")], offsets=[0]; let length=chunks[0].length;
 objects.forEach((object,i)=> {
  offsets.push(length);
  const data=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),Buffer.isBuffer(object)?object:Buffer.from(object),Buffer.from("\nendobj\n")]);
  chunks.push(data);length+=data.length;
 });
 const xref=length;
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+
  offsets.slice(1).map(x=>String(x).padStart(10,"0")+" 00000 n \n").join("")+
  `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return new Uint8Array(Buffer.concat(chunks));
}
function stream(data,attrs="") {data=Buffer.from(data);return Buffer.concat([
 Buffer.from(`<< ${attrs} /Length ${data.length} >>\nstream\n`),data,Buffer.from("\nendstream")]);}
async function main() {
 const canvasPackage=require("@napi-rs/canvas");
 for (const key of ["DOMMatrix","ImageData","Path2D"]) global[key]=canvasPackage[key];
 const pdf=await import(pathToFileURL(path.resolve(__dirname,"vendor/pdfjs/pdf.min.mjs")));
 pdf.GlobalWorkerOptions.workerSrc=pathToFileURL(path.resolve(__dirname,"vendor/pdfjs/pdf.worker.min.mjs")).href;
 const html=fs.readFileSync(process.argv[2],"utf8");
 const assets=JSON.parse(html.match(/const TEXT_RESOURCES = (\{[^\n]*\});/)[1]);
 const fetched=[];
 class Resources {
  async fetch({kind,filename}) {
   fetched.push(kind+":"+filename);
   assert.ok(assets[kind]?.[filename],"缺失离线资源 "+kind+":"+filename);
   return new Uint8Array(Buffer.from(assets[kind][filename],"base64"));
  }
 }
 // 仓库提供的真实中文 OCR 样本被封装进 PDF 图片页。
 const jpeg=fs.readFileSync(path.resolve(__dirname,"../models/ppocrv6-tiny/sample.jpg"));
 const image=await canvasPackage.loadImage(jpeg), w=image.width,h=image.height;
 const text="BT /F1 14 Tf 1 0 0 1 40 140 Tm (contract contract) Tj ET";
 const data=makePdf([
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 10 0 R] /Count 4 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /CropBox [10 20 290 190] /Rotate 90 /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >>",
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 8 0 R >> >> /Contents 9 0 R >>`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  stream(text),stream(jpeg,`/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`),
  stream(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`),
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F2 11 0 R >> >> /Contents 14 0 R >>",
  "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [12 0 R] >>",
  "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor 13 0 R /DW 1000 >>",
  "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-250 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
  stream("BT /F2 16 Tf 1 0 0 1 40 140 Tm <5408540C7F1653F7> Tj ET")
 ]);
 const loadingTask=pdf.getDocument({data,isEvalSupported:false,useWorkerFetch:false,
  cMapUrl:"embedded-cmaps/",cMapPacked:true,standardFontDataUrl:"embedded-fonts/",BinaryDataFactory:Resources});
 const document=await loadingTask.promise;
 const pages=[];
 for(let i=1;i<=4;i++) {
  const page=await document.getPage(i), viewport=page.getViewport({scale:1.5});
  const lines=G.extract(await page.getTextContent(),viewport,pdf.Util);
  pages.push({page_number:i,lines});
  for(const line of lines) {
   assert.ok(line.box.every(Number.isFinite));
   for(let j=0;j<8;j+=2) {
    const restored=viewport.convertToPdfPoint(line.box[j],line.box[j+1]);
    assert.ok(Math.abs(restored[0]-line.pdf_box[j])<.00001);
    assert.ok(Math.abs(restored[1]-line.pdf_box[j+1])<.00001);
   }
  }
  if(i===3) {
   assert.equal(lines.length,0);
   const ops=await page.getOperatorList();
   assert.ok(ops.fnArray.includes(pdf.OPS.paintImageXObject));
   const view=page.getViewport({scale:1}), canvas=canvasPackage.createCanvas(w,h);
   await page.render({canvasContext:canvas.getContext("2d"),viewport:view}).promise;
   const rgba=canvas.getContext("2d").getImageData(0,0,w,h).data;
   const rgb=Buffer.alloc(w*h*3);
   for(let n=0;n<w*h;n++) {rgb[n*3]=rgba[n*4];rgb[n*3+1]=rgba[n*4+1];rgb[n*3+2]=rgba[n*4+2];}
   if(process.argv[3])fs.writeFileSync(process.argv[3],Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`),rgb]));
  }
  page.cleanup();
 }
 assert.equal(S.search(pages,["contract"])[0].count,4);
 assert.equal(S.search(pages,["合同编号"])[0].count,1);
 assert.equal(pages[1].lines[0].pdf_box.length,8);
 assert.ok(fetched.some(x=>x.startsWith("cMapUrl:")));
 assert.ok(fetched.some(x=>x.startsWith("standardFontDataUrl:")));
 await loadingTask.destroy();
 console.log(JSON.stringify({passed:true,pages:4,latinMatches:4,chineseMatches:1,
  rotatedCropBox:true,scannedPageRendered:true,embeddedResourcesRequested:fetched}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
