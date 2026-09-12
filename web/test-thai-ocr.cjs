"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const Search=require("./pdf-search.js");
const context={};
vm.runInNewContext(fs.readFileSync(__dirname+"/thai-ocr.js","utf8").replace("__LW_THAI_ASSETS__","{}"),context);
test("Thai line conversion preserves tone marks, pixel coordinates and confidence scope",()=>{
 const raw=(text,confidence,bbox={x0:20,y0:30,x1:220,y1:60})=>({text,confidence,bbox});
 const lines=context.LwThaiOcr.linesFromBlocks([{paragraphs:[{lines:[
  raw(" สัญญาเช่า สัญญาเช่า\n",92),raw("จํานวนเงิน",null),raw("",99),raw("invalid",99,{})
 ]}]}]);
 assert.equal(lines.length,2);assert.equal(lines[0].text,"สัญญาเช่า สัญญาเช่า");
 assert.deepEqual(Array.from(lines[0].box),[20,30,220,30,220,60,20,60]);
 assert.equal(lines[0].rec_score,.92);assert.equal(lines[0].det_score,null);
 assert.equal(lines[1].rec_score,null);
 const results=Search.search([{page_number:1,lines}],["สัญญาเช่า","จำนวนเงิน"]);
 assert.deepEqual(results.map(x=>x.count),[2,1]);
 assert.deepEqual(results[0].pages[0].confidences,[.92,.92]);
 assert.equal(results[1].matches[0].confidence,null);
 assert.equal(Search.normalize("สัญญาเช่า")===Search.normalize("สัญญาเชา"),false);
});
