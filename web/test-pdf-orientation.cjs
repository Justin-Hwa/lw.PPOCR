"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const O=require("./pdf/orientation.js");
const line=(box,text="Orientation text",rec_score=.95)=>({box,text,rec_score});
test("文字层按基线计算四种方向，竖排与空白不被强制转成横排",()=>{
 for(const [box,rotation] of [
  [[0,0,100,0,100,10,0,10],0],[[0,0,0,100,-10,100,-10,0],270],
  [[100,10,0,10,0,0,100,0],180],[[0,100,0,0,10,0,10,100],90]
 ])assert.equal(O.fromText([line(box)]).rotation,rotation);
 assert.equal(O.fromText([]),null);
 assert.equal(O.fromText([{...line([0,0,0,100,-10,100,-10,0]),direction:"ttb"}]),null);
});
test("单行自动裁剪转正不能替代整页方向；低分、接近或空白保留原方向",()=>{
 const horizontal=O.score([line([0,0,100,0,100,10,0,10])]);
 const vertical=O.score([line([0,0,10,0,10,100,0,100])]);
 assert.ok(horizontal.score > vertical.score*10);
 assert.equal(O.choose([{rotation:90,score:100,characters:100},{rotation:0,score:30,characters:60}]).rotation,90);
 assert.equal(O.choose([{rotation:180,score:100,characters:100},{rotation:0,score:95,characters:90}]).rotation,0);
 assert.equal(O.choose([{rotation:90,score:5,characters:10}]).method,"uncertain");
 assert.equal(O.choose([]).rotation,0);
});
test("方向探测中停止会释放画布，不把最后一个候选缓存为结果",async()=>{
 const previous=global.document, canvases=[];
 global.document={createElement:()=>{const c={getContext:()=>({translate(){},rotate(){},drawImage(){}})};canvases.push(c);return c;}};
 let calls=0,stopped=false;
 try {
  await assert.rejects(O.detect({canvas:{width:100,height:50},extractText:async()=>[]},async()=>{
   calls++;if(calls===4)stopped=true;
   return {lines:[line([0,0,100,0,100,10,0,10],"Orientation cancellation check 12345")]};
  },()=>stopped),{code:"LW_PDF_CANCELLED"});
  assert.equal(calls,4);
  assert.ok(canvases.every(c=>c.width===1&&c.height===1));
 } finally {global.document=previous;}
});
test("不可靠的文字层不会短路图像方向判断；诊断只记录候选分数",async()=>{
 const previous=global.document;
 global.document={createElement:()=>({getContext:()=>({translate(){},rotate(){},drawImage(){}})})};
 const text=[line([0,0,100,0,100,10,0,10])];text.unreliable=true;
 let calls=0;
 try {
  const result=await O.detect({canvas:{width:100,height:50},extractText:async()=>text},async()=>({
   lines:[line([0,0,100,0,100,10,0,10],"Private document text for orientation check 12345",++calls===2?.95:.2)]
  }));
  assert.equal(calls,4);assert.equal(result.rotation,90);assert.equal(result.candidates.length,4);
  assert.ok(!JSON.stringify(result).includes("Private"));
 } finally {global.document=previous;}
});
