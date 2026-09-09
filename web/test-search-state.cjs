/* 无浏览器的控制器状态回归：只替换外部 PDF/OCR 与页面节点，执行真实 UI 脚本。 */
"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const Search=require("./pdf-search.js");
class Element {
 constructor(){this.value="";this.checked=false;this.children=[];this.dataset={};this.listeners={};this.width=100;this.height=100;
  this.classList={toggle(){},add(){},remove(){}};}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(){} removeAttribute(){} toggleAttribute(){} scrollIntoView(){} remove(){} click(){}
 appendChild(child){this.children.push(child);return child;} replaceChildren(){this.children=[];}
 querySelectorAll(){return [];} getContext(){return {drawImage(){}};}
}
function line(text,source="text-layer",score=null){return {text,source,rec_score:score,det_score:score,box:[0,0,80,0,80,10,0,10],pdf_box:[0,90,80,90,80,100,0,100]};}
async function setup(pages,opts={}) {
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 get("search-spaces").checked=true; get("search-queries").value="合同\n不存在";
 get("pdf-mode").value=opts.mode||"auto";get("pdf-scope").value="all";get("pdf-dpi").value="180";get("reading-order").value="horizontal-ltr";
 let ocrCalls=0,context;
 const engine={getStatus:()=>({ready:true,backend:"worker"}),destroy(){},async recognize(input){
  ocrCalls++; if(opts.onOcr)opts.onOcr(context);
  return {image:{width:100,height:100},lines:input.ocr||[],timing:{total_ms:1}};
 }};
 const doc={pageCount:pages.length,async close(){},cancelRender(){},async renderPage(n){
  if(opts.failPage===n)throw Error("render failed");
  return {canvas:{ocr:pages[n-1].ocr},width:100,height:100,pdfWidth:100,pdfHeight:100,rotation:0,
   toPdfPoint:(x,y)=>[x,100-y],release(){},async extractText(){return pages[n-1].text||[];},async hasRasterImages(){return !!pages[n-1].image;}};
 }};
 context={console:{...console,error(){}},performance,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),LwPdfSearch:Search,
  navigator:{},CustomEvent:class {constructor(name,options){this.type=name;this.detail=options.detail;}},
  LwPpocr:{create:async()=>engine},LwPdf:{open:async()=>doc,getStatus:()=>({}),dispose(){}},
  document:{getElementById:get,body:new Element(),createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){},dispatchEvent(){}},addEventListener(){}};
 context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"ocr-demo-ui.js"),"utf8"),context);
 await context.lwPpocrDemo.ready(); await context.__lwOcrTest.selectFile({name:"fixture.pdf",type:"application/pdf"});
 return {context,get,ocrCalls:()=>ocrCalls};
}
test("文字 PDF 不运行 OCR；所有查询显示结果；重新检索无需推理",async()=>{
 const {context,get,ocrCalls}=await setup([{text:[line("合同 合同")]}]);
 await context.__lwOcrTest.runOcr();let result=context.__lwOcrTest.structuredResult();
 assert.equal(ocrCalls(),0);assert.equal(result.search.complete,true);
 assert.equal(result.search.results[0].count,2);assert.equal(result.search.results[1].count,0);
 assert.equal(get("search-results").children.length,2);
 get("search-queries").value="合";context.__lwOcrTest.refreshSearch();
 assert.equal(ocrCalls(),0);assert.equal(result.search.results[0].count,2);
});
test("混合 PDF 去重并保留分数，跨页统计完整",async()=>{
 const {context,ocrCalls}=await setup([{text:[line("合同")],image:true,ocr:[line("合同","ocr",.94)]},{ocr:[line("合同","ocr",.87)]}]);
 await context.__lwOcrTest.runOcr();const result=context.__lwOcrTest.structuredResult();
 assert.equal(ocrCalls(),2);assert.equal(result.search.results[0].count,2);
 assert.equal(result.search.results[0].matches[0].confidence,null);
 assert.equal(result.search.results[0].matches[1].confidence,.87);
 assert.equal(result.document.status,"complete");
});
test("停止后未检查页不能报未找到，按钮恢复可用",async()=>{
 const {context,get}=await setup([{ocr:[line("合同","ocr",.9)]},{ocr:[]}],{onOcr:c=>c.__lwOcrTest.cancelPdfOcr()});
 await context.__lwOcrTest.runOcr();const result=context.__lwOcrTest.structuredResult();
 assert.equal(result.document.status,"stopped");assert.equal(result.document.processed_pages,1);
 assert.equal(result.search.complete,false);assert.match(get("search-coverage").textContent,/尚未检查/);
 assert.equal(get("run").disabled,false);
});
test("后续页出错保留已检查结果并标记不完整",async()=>{
 const {context}=await setup([{text:[line("合同")]},{text:[]}],{failPage:2});
 await assert.rejects(context.__lwOcrTest.runOcr());const result=context.__lwOcrTest.structuredResult();
 assert.equal(result.document.status,"error");assert.equal(result.search.complete,false);
 assert.equal(result.search.results[0].count,1);
});
