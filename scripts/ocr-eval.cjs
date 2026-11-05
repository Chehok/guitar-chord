#!/usr/bin/env node
'use strict';
// Dependencies stay outside the repo:
// npm install --prefix /tmp/gc-tuner-ocr tesseract.js@5.1.1
// NODE_PATH=/tmp/gc-tuner-ocr/node_modules node scripts/ocr-eval.cjs [image.png]
// Requires Python 3 + Pillow for image I/O only; all preprocessing is the app's JS.
// OCR_LANG_PATH=/path/to/traineddata uses local, uncompressed eng.traineddata offline.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {execFile}=require('node:child_process');
const Tesseract=require('tesseract.js');
if(require('tesseract.js/package.json').version!=='5.1.1')throw Error('Install tesseract.js@5.1.1 under /tmp (see script header).');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const context=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('// Score music functions:'),html.indexOf('// End score music functions.')),context);
function python(code,args=[],input){
return new Promise((resolve,reject)=>{
const child=execFile('python3',['-c',code,...args],{encoding:'buffer',maxBuffer:100*1024*1024},(error,stdout)=>error?reject(error):resolve(stdout));
child.stdin.on('error',reject);child.stdin.end(input);
});
}
async function main(){
const filename=path.resolve(process.argv[2]||path.join(__dirname,'../.ref/sample-score.png'));
const cache=fs.mkdtempSync(path.join(os.tmpdir(),'gc-tuner-ocr-eval-'));
let worker;
try{
const raw=await python('from PIL import Image\nimport sys,struct\nim=Image.open(sys.argv[1]).convert("RGBA")\nsys.stdout.buffer.write(struct.pack(">II",*im.size)+im.tobytes())',[filename]);
const original={width:raw.readUInt32BE(0),height:raw.readUInt32BE(4),data:raw.subarray(8)};
const size=context.scoreImageSize(original.width,original.height);
const source=context.resizeScorePixels(original,size.width,size.height),processed=context.scoreImageSize(source.width,source.height,true);
console.log(`Image: ${original.width}×${original.height}; source: ${source.width}×${source.height}; OCR: ${processed.width}×${processed.height}`);
const langPath=process.env.OCR_LANG_PATH;
worker=await Tesseract.createWorker('eng',1,{cachePath:cache,...(langPath?{langPath:path.resolve(langPath),gzip:false}:{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'})},context.scoreOCRConfig());
const encode=image=>python('from PIL import Image\nimport sys\nim=Image.frombytes("RGBA",(int(sys.argv[1]),int(sys.argv[2])),sys.stdin.buffer.read())\nim.save(sys.stdout.buffer,format="PNG")',[String(image.width),String(image.height)],Buffer.from(image.data));
let pass=0,variant,psm;
const adapter={setParameters:p=>{psm=p.tessedit_pageseg_mode;return worker.setParameters(p);},recognize:async input=>{
const {data}=await worker.recognize(input);
const codes=variant==='region'?[context.normalizeScoreOCR(data.text)].filter(Boolean).map(text=>({text})):context.scoreOCRWords(data.words||[],processed,source,variant);
console.log(`Pass ${++pass} (${variant}, PSM ${psm}): ${codes.length} candidates — ${codes.map(c=>c.text).join(' ')}`);
if(process.env.OCR_DEBUG)console.log(JSON.stringify(data.words.map(({text,confidence,bbox})=>({text,confidence,bbox}))));
return {data};
}};
const codes=await context.runScoreOCRPasses(adapter,source,encode,(_index,_total,name)=>{variant=name;});
console.log(`Merged: ${codes.length} chord occurrences (${new Set(codes.map(c=>c.text)).size} distinct names)`);
console.log(JSON.stringify(codes.map(({text,bbox,confidence,variant})=>({text,bbox,confidence:Math.round(confidence),variant})),null,2));
}finally{
if(worker)await worker.terminate();
fs.rmSync(cache,{recursive:true,force:true});
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
