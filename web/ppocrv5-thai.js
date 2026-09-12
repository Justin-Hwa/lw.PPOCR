/* Official th_PP-OCRv5_mobile_rec, CTC decoding and perspective crops.
 * Detection boxes come from the existing PP-OCRv6 SDK; its recognition text is discarded.
 * All inference runs in a local worker. No network requests or persistent model cache.
 */
(function(root) {
  'use strict';
  const ASSETS = __LW_V5_THAI_ASSETS__;
  function decodeCTC(data, dims, dictionary) {
    const classes=dims[dims.length-1], steps=dims[dims.length-2];
    if (dims.length!==3 || dims[0]!==1 || classes!==dictionary.length+1)
      throw new Error('PP-OCRv5 Thai output/dictionary mismatch');
    let previous=-1, text='', sum=0, count=0;
    for(let step=0;step<steps;step++) {
      let best=0;
      for(let c=1;c<classes;c++) if(data[step*classes+c]>data[step*classes+best]) best=c;
      const score=data[step*classes+best];
      if(!Number.isFinite(score)) throw new Error('Invalid PP-OCRv5 Thai confidence');
      if(best!==0 && best!==previous) {text+=dictionary[best-1];sum+=score;count++;}
      previous=best;
    }
    return {text,rec_score:count?Math.max(0,Math.min(1,sum/count)):0};
  }
  function cropTensor(rgba, width, height, box) {
    if(box.length!==8 || !box.every(Number.isFinite)) throw new Error('Invalid OCR quadrilateral');
    let p=Array.from({length:4},(_,i)=>[box[2*i],box[2*i+1]]);
    const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
    let w=Math.max(distance(p[0],p[1]),distance(p[2],p[3]));
    let h=Math.max(distance(p[0],p[3]),distance(p[1],p[2]));
    if(w<1 || h<1) throw new Error('Degenerate OCR quadrilateral');
    if(h/w>=1.5) {p=[p[1],p[2],p[3],p[0]];[w,h]=[h,w];}
    const resized=Math.max(1,Math.min(3200,Math.ceil(48*w/h))), target=Math.max(320,resized);
    const output=new Float32Array(3*48*target);
    const dx1=p[1][0]-p[2][0],dx2=p[3][0]-p[2][0],dx3=p[0][0]-p[1][0]+p[2][0]-p[3][0];
    const dy1=p[1][1]-p[2][1],dy2=p[3][1]-p[2][1],dy3=p[0][1]-p[1][1]+p[2][1]-p[3][1];
    const determinant=dx1*dy2-dx2*dy1;
    if(Math.abs(determinant)<1e-8) throw new Error('Degenerate OCR perspective');
    const g=(dx3*dy2-dx2*dy3)/determinant,hg=(dx1*dy3-dx3*dy1)/determinant;
    const a=p[1][0]-p[0][0]+g*p[1][0],b=p[3][0]-p[0][0]+hg*p[3][0];
    const d=p[1][1]-p[0][1]+g*p[1][1],e=p[3][1]-p[0][1]+hg*p[3][1];
    for(let y=0;y<48;y++) for(let x=0;x<resized;x++) {
      const u=(x+.5)/resized,v=(y+.5)/48,z=g*u+hg*v+1;
      const sx=Math.max(0,Math.min(width-1,(a*u+b*v+p[0][0])/z-.5));
      const sy=Math.max(0,Math.min(height-1,(d*u+e*v+p[0][1])/z-.5));
      const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=sx-x0,fy=sy-y0;
      for(let c=0;c<3;c++) {
        const offset=2-c;
        const value=(1-fy)*((1-fx)*rgba[(y0*width+x0)*4+offset]+fx*rgba[(y0*width+x1)*4+offset])+
          fy*((1-fx)*rgba[(y1*width+x0)*4+offset]+fx*rgba[(y1*width+x1)*4+offset]);
        output[c*48*target+y*target+x]=value/127.5-1;
      }
    }
    return {data:output,dims:[1,3,48,target]};
  }
  function workerMain() {
    let session,dictionary;
    self.onmessage=async({data:job})=>{
      try {
        if(job.action==='init') {
          ort.env.wasm.numThreads=1;
          ort.env.wasm.proxy=false;
          const moduleUrl=URL.createObjectURL(new Blob([job.mjs],{type:'text/javascript'}));
          const wasmUrl=URL.createObjectURL(new Blob([job.wasm],{type:'application/wasm'}));
          ort.env.wasm.wasmPaths={mjs:moduleUrl,wasm:wasmUrl};
          dictionary=job.dictionary;
          try { session=await ort.InferenceSession.create(job.model,{executionProviders:['wasm'],graphOptimizationLevel:'all',logSeverityLevel:3}); }
          finally { URL.revokeObjectURL(moduleUrl); URL.revokeObjectURL(wasmUrl); }
          self.postMessage({id:job.id,result:true});
        } else {
          const lines=[];
          for(const line of job.lines) {
            const input=cropTensor(job.pixels,job.width,job.height,line.box);
            const tensor=new ort.Tensor('float32',input.data,input.dims);
            const outputs=await session.run({[session.inputNames[0]]:tensor});
            const result=outputs[session.outputNames[0]];
            const decoded=decodeCTC(result.data,result.dims,dictionary);
            lines.push({index:lines.length,box:line.box,det_score:line.det_score,...decoded,source:'ocr',ocr_engine:'ppocrv5-thai'});
            tensor.dispose();
            for(const output of Object.values(outputs)) output.dispose();
          }
          self.postMessage({id:job.id,result:lines});
        }
      } catch(error) {self.postMessage({id:job.id,error:String(error.message||error)});}
    };
  }
  async function create() {
    const bytes=key=>Uint8Array.from(atob(ASSETS[key]),c=>c.charCodeAt(0));
    const urls=[];
    const url=parts=>{const value=URL.createObjectURL(new Blob(parts,{type:'text/javascript'}));urls.push(value);return value;};
    let worker, failure, sequence=0;
    const pending=new Map();
    function destroy(error=new Error('PP-OCRv5 Thai worker closed')) {
      failure=error;
      if(worker) worker.terminate();
      for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}
      pending.clear();urls.splice(0).forEach(URL.revokeObjectURL);
    }
    function call(payload,transfer=[]) {
      if(failure) return Promise.reject(failure);
      return new Promise((resolve,reject)=>{
        const id=++sequence,timer=setTimeout(()=>destroy(new Error('PP-OCRv5 Thai timed out')),180000);
        pending.set(id,{resolve,reject,timer});
        try {worker.postMessage({id,...payload},transfer);} catch(error){destroy(error);}
      });
    }
    try {
      worker=new Worker(url([bytes('js'),'\n',decodeCTC.toString(),'\n',cropTensor.toString(),'\n('+workerMain.toString()+')();']));
      worker.onerror=event=>{event.preventDefault();destroy(new Error(event.message||'PP-OCRv5 Thai worker failed'));};
      worker.onmessageerror=()=>destroy(new Error('PP-OCRv5 Thai worker message failed'));
      worker.onmessage=({data})=>{
        const job=pending.get(data.id);if(!job)return;
        if(data.error){destroy(new Error(data.error));return;}
        clearTimeout(job.timer);pending.delete(data.id);job.resolve(data.result);
      };
      const model=bytes('model'),wasm=bytes('wasm');
      await call({action:'init',mjs:bytes('mjs'),model,wasm,dictionary:ASSETS.dictionary},[model.buffer,wasm.buffer]);
    } catch(error){destroy(error);throw error;}
    return {destroy,async recognize(canvas,detect) {
      const started=performance.now();
      const detection=await detect(canvas);
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const lines=await call({action:'recognize',pixels,width:canvas.width,height:canvas.height,lines:detection.lines},[pixels.buffer]);
      const elapsed=performance.now()-started;
      return {source:'image',image:{width:canvas.width,height:canvas.height},lines,
        options:{use_cls:false,reading_order:'horizontal-ltr',ocr_language:'ppocrv5-thai',ocr_engine:'ppocrv5-thai'},
        timing:{total_ms:elapsed,inference_ms:elapsed}};
    }};
  }
  root.LwPpocrV5Thai=Object.freeze({create,decodeCTC,cropTensor});
})(globalThis);
