#!/usr/bin/env node
'use strict';
// Dependencies stay outside the repo:
// npm install --prefix /tmp/gc-tuner-ocr tesseract.js@5.1.1
// NODE_PATH=/tmp/gc-tuner-ocr/node_modules node scripts/ocr-eval.cjs [image.png] [expected.json] [report-prefix]
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
const expected=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8')):null;
const output=process.argv[4]?path.resolve(process.argv[4]):null,started=Date.now(),attempts=[];
const cache=fs.mkdtempSync(path.join(os.tmpdir(),'gc-tuner-ocr-eval-'));
let worker;
try{
const raw=await python('from PIL import Image\nimport sys,struct\nim=Image.open(sys.argv[1]).convert("RGBA")\nsys.stdout.buffer.write(struct.pack(">II",*im.size)+im.tobytes())',[filename]);
const original={width:raw.readUInt32BE(0),height:raw.readUInt32BE(4),data:raw.subarray(8)};
if(expected&&(expected.width!==original.width||expected.height!==original.height))throw Error('Expected coordinates must use the original image dimensions.');
const size=context.scoreImageSize(original.width,original.height);
const source=context.resizeScorePixels(original,size.width,size.height),processed=context.scoreImageSize(source.width,source.height,true);
console.log(`Image: ${original.width}×${original.height}; source: ${source.width}×${source.height}; OCR: ${processed.width}×${processed.height}`);
const langPath=process.env.OCR_LANG_PATH;
worker=await Tesseract.createWorker('eng',1,{cachePath:cache,...(langPath?{langPath:path.resolve(langPath),gzip:false}:{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'})},context.scoreOCRConfig());
const encode=image=>python('from PIL import Image\nimport sys\nim=Image.frombytes("RGBA",(int(sys.argv[1]),int(sys.argv[2])),sys.stdin.buffer.read())\nim.save(sys.stdout.buffer,format="PNG")',[String(image.width),String(image.height)],Buffer.from(image.data));
let pass=0,variant,psm,regionBox;
const adapter={setParameters:p=>{psm=p.tessedit_pageseg_mode;return worker.setParameters(p);},recognize:async input=>{
const {data}=await worker.recognize(input);
const codes=variant==='region'?[context.normalizeScoreOCR(data.text)].filter(Boolean).map(text=>({text})):context.scoreOCRWords(data.words||[],processed,source,variant);
console.log(`Pass ${++pass} (${variant}, PSM ${psm}${regionBox?`, x=${regionBox.x0} y=${regionBox.y0}`:''}): ${codes.length} candidates — ${codes.map(c=>c.text).join(' ')}`);
attempts.push({pass,variant,psm,bbox:regionBox,text:data.text,confidence:data.confidence});
if(process.env.OCR_DEBUG)console.log(JSON.stringify((data.words||[]).map(({text,confidence,bbox})=>({text,confidence,bbox}))));
return {data};
}};
const codes=await context.runScoreOCRPasses(adapter,source,encode,(_index,_total,name,bbox)=>{variant=name;regionBox=bbox||null;});
console.log(`Merged: ${codes.length} chord occurrences (${new Set(codes.map(c=>c.text)).size} distinct names)`);
const names=[...new Set(codes.map(c=>c.text))].sort();
console.log(`Names: ${names.join(', ')}`);
// Reports and truth matching always use original-image coordinates, even after downscaling.
const result=codes.map(({text,bbox,confidence,variant,support})=>({text,bbox:{x0:bbox.x0*original.width/source.width,y0:bbox.y0*original.height/source.height,x1:bbox.x1*original.width/source.width,y1:bbox.y1*original.height/source.height},confidence,variant,support}));
let evaluation=null;
if(expected){
const area=b=>(b.x1-b.x0)*(b.y1-b.y0),remaining=new Set(result),missing=[],wrong=[],matched=[];
for(const truth of expected.chords){
const overlap=found=>Math.max(0,Math.min(found.bbox.x1,truth.bbox.x1)-Math.max(found.bbox.x0,truth.bbox.x0))*Math.max(0,Math.min(found.bbox.y1,truth.bbox.y1)-Math.max(found.bbox.y0,truth.bbox.y0))/Math.max(1,Math.min(area(found.bbox),area(truth.bbox)));
const found=[...remaining].filter(c=>overlap(c)>.45).sort((a,b)=>overlap(b)-overlap(a))[0];
if(!found){missing.push(truth);continue;}
remaining.delete(found);
if(found.text===truth.text)matched.push(truth);else wrong.push({...truth,actual:found.text});
}
evaluation={expected:expected.chords.length,correct:matched.length,missing,wrong,extra:[...remaining],matched};
console.log(`Verified: ${matched.length}/${expected.chords.length}; missing ${missing.length}, wrong ${wrong.length}, extra ${remaining.size}`);
for(const [label,items] of [['MISSING',missing],['WRONG',wrong],['EXTRA',[...remaining]]])for(const c of items)console.log(`${label}: ${c.text}${c.actual?` (read ${c.actual})`:''} at (${Math.round(c.bbox.x0)}, ${Math.round(c.bbox.y0)})`);
if(missing.length||wrong.length||remaining.size)process.exitCode=1;
}
console.log(JSON.stringify(result,null,2));
const report={image:filename,width:original.width,height:original.height,count:result.length,names,seconds:(Date.now()-started)/1000,codes:result,evaluation,attempts};
console.log(`Elapsed: ${report.seconds.toFixed(1)}s`);
if(output){
fs.writeFileSync(output+'.json',JSON.stringify(report,null,2)+'\n');
const marks=evaluation?[...evaluation.matched.map(c=>({...c,color:'green'})),...evaluation.missing.map(c=>({...c,color:'red'})),...evaluation.wrong.map(c=>({...c,text:c.text+' <- '+c.actual,color:'orange'})),...evaluation.extra.map(c=>({...c,color:'blue'}))]:result.map(c=>({...c,color:'green'}));
await python('from PIL import Image,ImageDraw\nimport sys,json\nim=Image.open(sys.argv[1]).convert("RGB")\nd=ImageDraw.Draw(im)\nfor c in json.load(sys.stdin):\n b=c["bbox"]; x,y=b["x0"],b["y0"]; d.rectangle((x-2,y-2,b["x1"]+2,b["y1"]+2),outline=c["color"],width=2); d.text((x,y-15),c["text"],fill=c["color"])\nim.save(sys.argv[2])',[filename,output+'.png'],JSON.stringify(marks));
console.log(`Report: ${output}.json; coordinates: ${output}.png`);
}
}finally{
if(worker)await worker.terminate();
fs.rmSync(cache,{recursive:true,force:true});
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
