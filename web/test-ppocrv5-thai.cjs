const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/ppocrv5-thai.js','utf8').replace('__LW_V5_THAI_ASSETS__','{}'),context);
const api=context.LwPpocrV5Thai;
test('Thai CTC preserves combining marks, blank-separated repeats and space confidence',()=>{
 const indices=[1,1,2,0,2,3,0],data=new Float32Array(indices.length*4);
 indices.forEach((v,i)=>data[i*4+v]=.9);
 const result=api.decodeCTC(data,[1,7,4],['ก','่',' ']);
 assert.equal(result.text,'ก่่ ');assert.ok(Math.abs(result.rec_score-.9)<1e-6);
 assert.throws(()=>api.decodeCTC(data,[1,7,5],['ก','่',' ']),/mismatch/);
});
test('BGR CHW normalization and neutral right padding follow model preprocessing',()=>{
 const rgba=new Uint8ClampedArray(8*8*4);
 for(let i=0;i<rgba.length;i+=4)rgba.set([255,127.5,0,255],i);
 const result=api.cropTensor(rgba,8,8,[0,0,8,0,8,8,0,8]);
 assert.deepEqual(Array.from(result.dims),[1,3,48,320]);
 assert.equal(result.data[0],-1);assert.equal(result.data[2*48*320],1);
 assert.equal(result.data[48],0);assert.equal(result.data[48*320+48],0);
 assert.throws(()=>api.cropTensor(rgba,8,8,[0,0,0,0,0,0,0,0]),/Degenerate/);
});
test('Skewed quad and portrait crops retain bounded finite model tensors',()=>{
 const pixels=new Uint8ClampedArray(100*100*4).fill(255);
 for(const box of [[10,5,90,15,80,60,5,50],[10,5,20,5,20,90,10,90]]){
  const result=api.cropTensor(pixels,100,100,box);
  assert.ok(result.data.every(Number.isFinite));assert.equal(result.data.length,result.dims[3]*48*3);
 }
});
