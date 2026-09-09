/* 无浏览器的控制器状态回归：只替换外部 PDF/OCR 与页面节点，执行真实 UI 脚本。 */
"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const Search=require("./pdf-search.js");
class Element {
 constructor(){this.value="";this.checked=false;this.children=[];this.dataset={};this.listeners={};this.width=100;this.height=100;
  this.style={};this.attributes={};this.clientWidth=600;this.parentNode=null;this.open=false;
  this.scrollLeft=0;this.scrollTop=0;this.captured=new Set();
  const classes=new Set();this.classList={toggle(k,on){if(on)classes.add(k);else classes.delete(k);},add(k){classes.add(k);},remove(k){classes.delete(k);},contains:k=>classes.has(k)};}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return this.attributes[k]??null;}
 removeAttribute(k){delete this.attributes[k];} toggleAttribute(){} scrollIntoView(){} remove(){} click(){return this.listeners.click?.({target:this});} focus(){}
 showModal(){this.open=true;} close(){this.open=false;this.listeners.close?.();}
 setPointerCapture(id){this.captured.add(id);} hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);}
 appendChild(child){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(n=>n!==child);this.children.push(child);child.parentNode=this;return child;} replaceChildren(){this.children=[];}
 querySelectorAll(){return [];} getContext(){return {drawImage(){}};}
}
function line(text,source="text-layer",score=null){return {text,source,rec_score:score,det_score:score,box:[0,0,80,0,80,10,0,10],pdf_box:[0,90,80,90,80,100,0,100]};}
async function setup(pages,opts={}) {
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const events={},storage=opts.storage||new Map();
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
  navigator:{},CustomEvent:class {constructor(name,options={}){this.type=name;this.detail=options.detail;}},
  LwPpocr:{create:async()=>engine},LwPdf:{open:async()=>doc,getStatus:()=>({}),dispose(){}},
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  getComputedStyle:()=>({paddingLeft:"12px",paddingRight:"12px"}),
  document:{getElementById:get,documentElement:new Element(),querySelectorAll:()=>[],body:new Element(),createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){},dispatchEvent(){}},
  addEventListener(name,fn){(events[name]??=[]).push(fn);},dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);}};
 context.window=context;
 get("preview-region").appendChild(get("preview-content"));
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"i18n.js"),"utf8"),context);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"ocr-demo-ui.js"),"utf8"),context);
 await context.lwPpocrDemo.ready(); await context.__lwOcrTest.selectFile({name:"fixture.pdf",type:"application/pdf"});
 return {context,get,storage,ocrCalls:()=>ocrCalls};
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

test("四种语言切换翻译动态结果，保留查询、原文、分数和折叠状态",async()=>{
 const {context,get,storage,ocrCalls}=await setup([{ocr:[line("合同","ocr",.87)]}]);
 await context.__lwOcrTest.runOcr();
 get("search-results").children[0].open=false;
 const original=JSON.stringify(context.__lwOcrTest.structuredResult());
 const labels={"en":"Page 1","ja":"1 ページ","th":"หน้า 1","zh-CN":"第 1 页"};
 for(const [language,label] of Object.entries(labels)){
  context.LwI18n.setLanguage(language);
  assert.equal(context.document.documentElement.lang,language);
  assert.equal(storage.get("lw-language"),language);
  assert.ok(get("search-results").children[0].children[1].textContent.includes(label));
  assert.equal(get("search-results").children[0].open,false);
  assert.equal(get("search-queries").value,"合同\n不存在");
  assert.equal(JSON.stringify(context.__lwOcrTest.structuredResult()),original);
 }
 assert.equal(ocrCalls(),1);
});

test("主题及语言偏好持久化；切换主题不会重置当前提示",async()=>{
 const storage=new Map([["lw-language","th"],["lw-theme","dark"]]);
 const {context,get}=await setup([{text:[line("合同")]}],{storage});
 assert.equal(context.document.documentElement.lang,"th");
 assert.equal(context.document.documentElement.dataset.theme,"dark");
 const before=get("status").textContent;
 context.LwI18n.setTheme("light");
 assert.equal(get("status").textContent,before);
 assert.equal(storage.get("lw-theme"),"light");
 const reopened=await setup([{text:[]}],{storage});
 assert.equal(reopened.context.document.documentElement.dataset.theme,"light");
 context.LwI18n.setLanguage("invalid");
 assert.equal(context.LwI18n.language,"th");
});

test("弹窗共用画布、支持翻页与缩放，关闭后还原到卡片",async()=>{
 const {context,get}=await setup([{text:[line("合同")]},{text:[]}]);
 const content=get("preview-content");
 await context.__lwOcrTest.runOcr();
 context.__lwOcrTest.openPreview();
 assert.equal(get("preview-dialog").open,true);
 assert.equal(content.parentNode,get("dialog-content"));
 assert.equal(get("preview-next").disabled,true);
 await get("preview-prev").click();
 assert.equal(context.__lwOcrTest.snapshot().pdfCurrentPage,1);
 assert.equal(get("preview-next").disabled,false);
 context.__lwOcrTest.changeZoom(.25);
 assert.equal(get("zoom-label").textContent,"125%");
 assert.equal(get("preview-stage").style.width,"720px");
 context.__lwOcrTest.changeZoom(100);
 assert.equal(get("zoom-label").textContent,"400%");
 assert.equal(get("zoom-in").disabled,true);
 context.__lwOcrTest.changeZoom(-100);
 assert.equal(get("zoom-label").textContent,"25%");
 assert.equal(get("zoom-out").disabled,true);
 get("zoom-fit").click();
 assert.equal(get("zoom-label").textContent,"100%");
 context.__lwOcrTest.closePreview();
 assert.equal(content.parentNode,get("preview-region"));
 assert.equal(get("preview-dialog").open,false);
 get("preview-collapse").click();
 assert.equal(content.hidden,true);
 get("preview-collapse").click();
 assert.equal(content.hidden,false);
 assert.equal(context.__lwOcrTest.structuredResult().search.results[0].count,1);
});

test("进度按已处理页数计量，停止和失败保留真实进度，识别期间可以换语言主题",async()=>{
 const observed=[];
 const {context,get}=await setup([{ocr:[]},{ocr:[]}],{onOcr:c=>{
  const bar=c.document.getElementById("pdf-progress-bar");
  observed.push(bar.getAttribute("aria-valuenow"));
  c.LwI18n.setLanguage("en");c.LwI18n.setTheme("dark");
  assert.equal(c.document.getElementById("run").textContent,"Stop");
 }});
 await context.__lwOcrTest.runOcr();
 assert.deepEqual(observed,["0","1"]);
 assert.equal(get("pdf-progress-bar").getAttribute("aria-valuenow"),"2");
 assert.equal(get("pdf-progress-bar").getAttribute("aria-valuemax"),"2");
 assert.equal(get("pdf-progress").hidden,false);
 assert.equal(get("pdf-progress").dataset.running,"false");
 assert.equal(get("progress-fill").style.width,"100%");
 const stopped=await setup([{ocr:[]},{ocr:[]}],{onOcr:c=>c.__lwOcrTest.cancelPdfOcr()});
 await stopped.context.__lwOcrTest.runOcr();
 assert.equal(stopped.get("progress-fill").style.width,"50%");
 assert.equal(stopped.get("pdf-progress").dataset.running,"false");
 const failed=await setup([{text:[]},{text:[]}],{failPage:2});
 await assert.rejects(failed.context.__lwOcrTest.runOcr());
 assert.equal(failed.get("progress-fill").style.width,"50%");
 failed.context.LwI18n.setLanguage("en");
 assert.match(failed.get("pdf-progress-label").textContent,/Failed/);
});

test("所有静态与动态翻译键均包含四语文案及相同参数",async()=>{
 const {context}=await setup([{text:[]}]);
 const messages=context.LwI18n.messages;
 const template=fs.readFileSync(path.join(__dirname,"ocr-demo.template.html"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"ocr-demo-ui.js"),"utf8");
 const keys=[...template.matchAll(/data-i18n(?:-aria-label|-placeholder)?="([^"]+)"/g)].map(m=>m[1].replaceAll("&#10;","\n"));
 keys.push(...[...ui.matchAll(/\bt\(["']([^"']+)["']/g)].map(m=>m[1]).filter(k=>k!=="进度"));
 for(const key of keys)assert.ok(messages[key],"Missing translation: "+key);
 for(const [key,values] of Object.entries(messages)){
  assert.equal(values.length,4,key);
  const params=Array.from(values[0].matchAll(/\{\d+\}/g),m=>m[0]).sort();
  values.forEach(value=>{
   assert.ok(value.length,key);
   assert.deepEqual(Array.from(value.matchAll(/\{\d+\}/g),m=>m[0]).sort(),params,key);
  });
 }
});

test("预览拖动平移及指针捕获：松开、取消、失焦后停止，弹窗内同样有效",async()=>{
 const {context,get}=await setup([{text:[line("合同")]}]);
 await context.__lwOcrTest.runOcr();
 const original=JSON.stringify(context.__lwOcrTest.structuredResult());
 const viewport=get("preview-viewport"),stage=get("preview-stage");
 const event=(values={})=>({pointerId:1,pointerType:"mouse",isPrimary:true,button:0,buttons:1,
  clientX:200,clientY:200,preventDefault(){this.prevented=true;},...values});
 for(const finish of ["pointerup","pointercancel","lostpointercapture","blur"]){
  viewport.scrollLeft=100;viewport.scrollTop=100;
  stage.listeners.pointerdown(event());
  assert.equal(viewport.hasPointerCapture(1),true);
  viewport.listeners.pointermove(event({clientX:150,clientY:170}));
  assert.equal(viewport.scrollLeft,150);assert.equal(viewport.scrollTop,130);
  viewport.listeners.pointermove(event({pointerId:2,clientX:50}));
  assert.equal(viewport.scrollLeft,150);
  if(finish==="blur")context.dispatchEvent({type:"blur"});
  else viewport.listeners[finish](event());
  assert.equal(viewport.hasPointerCapture(1),false);
  assert.equal(viewport.classList.contains("panning"),false);
  viewport.listeners.pointermove(event({clientX:100}));
  assert.equal(viewport.scrollLeft,150);
 }
 for(const values of [{button:2},{pointerType:"touch"},{isPrimary:false}]){
  const e=event(values);stage.listeners.pointerdown(e);
  assert.equal(viewport.hasPointerCapture(1),false);assert.equal(e.prevented,undefined);
 }
 context.__lwOcrTest.openPreview();
 stage.listeners.pointerdown(event());
 viewport.listeners.pointermove(event({clientX:100,clientY:100}));
 assert.equal(viewport.scrollLeft,250);assert.equal(viewport.scrollTop,230);
 context.__lwOcrTest.closePreview();
 assert.equal(viewport.hasPointerCapture(1),false);
 stage.listeners.pointerdown(event());
 viewport.listeners.pointermove(event({buttons:0}));
 assert.equal(viewport.hasPointerCapture(1),false);
 assert.equal(JSON.stringify(context.__lwOcrTest.structuredResult()),original);
});
