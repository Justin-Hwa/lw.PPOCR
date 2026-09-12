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
