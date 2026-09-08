"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const S = require("./pdf-search.js");
const line = (text, score=.95, x=0, y=0, w=100, source="ocr") =>
  ({text,rec_score:score,source,box:[x,y,x+w,y,x+w,y+10,x,y+10]});
const page = (lines,n=1) => ({page_number:n,lines});
test("多字符串、重复命中、未命中、逐页分数",()=> {
 const results=S.search([page([line("合同 合同",.91)]),page([line("合同",.84)],3)],["合同","不存在"]);
 assert.equal(results[0].count,3);
 assert.deepEqual(results[0].pages,[{page_number:1,count:2,confidences:[.91,.91]},{page_number:3,count:1,confidences:[.84]}]);
 assert.equal(results[1].count,0);
});
test("文字层置信度为 null；不把 null 变成 0 或 100%",()=> {
 const hit=S.search([page([line("ABC",null,0,0,100,"text-layer")])],["ABC"])[0].matches[0];
 assert.equal(hit.confidence,null);assert.equal(hit.source,"text-layer");
});
test("跨文本片段匹配，跨 OCR 行分数取最低值",()=> {
 const result=S.search([page([line("合同",.97,0,0,20),line("编号",.82,21,0,20)])],["合同编号"])[0];
 assert.equal(result.count,1);assert.equal(result.matches[0].confidence,.82);
 assert.equal(result.matches[0].boxes.length,2);
});
test("不跨页匹配；列间距不能被忽略空白拼接",()=> {
 assert.equal(S.search([page([line("合同")]),page([line("编号")],2)],["合同编号"])[0].count,0);
 assert.equal(S.search([page([line("合同",.9,0,0,20),line("编号",.9,200,0,20)])],["合同编号"])[0].count,0);
});
test("字面检索、重叠匹配、Unicode 和全半角规范化",()=> {
 assert.equal(S.search([page([line("aaaa")])],["aa"])[0].count,3);
 assert.equal(S.search([page([line("ＡＢＣ [a+b] 😀")])],["abc","[a+b]","😀"]).every(x=>x.count===1),true);
 assert.equal(S.search([page([line("ABC")])],["abc"],{caseSensitive:true})[0].count,0);
 assert.deepEqual(S.queries("ABC\nＡＢＣ\n\n合同"),["ABC","合同"]);
});
test("可关闭忽略空白；跨行忽略换行",()=> {
 assert.equal(S.search([page([line("合 同")])],["合同"],{ignoreWhitespace:false})[0].count,0);
 assert.equal(S.search([page([line("合同"),line("编号",.95,0,12)])],["合同编号"])[0].count,1);
});
test("相同位置文字层与 OCR 去重，不删除别处的相同内容",()=> {
 const merged=S.mergeLines([line("合同",null,0,0,100,"text-layer")],[line("合同"),line("合同",.88,0,30)]);
 assert.equal(merged.length,2);assert.equal(S.search([page(merged)],["合同"])[0].count,2);
});
test("多个文字片段覆盖一行 OCR 时去重",()=> {
 const merged=S.mergeLines([line("合同",null,0,0,50,"text-layer"),line("编号",null,50,0,50,"text-layer")],[line("合同编号")]);
 assert.equal(merged.length,2);
});
test("未知或越界的 OCR 分数不会虚构置信度",()=> {
 for(const score of [null,NaN,1.2,-1]) assert.equal(S.search([page([line("A",score)])],["A"])[0].matches[0].confidence,null);
});
