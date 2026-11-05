'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const pure=script.slice(script.indexOf('// Score music functions:'),script.indexOf('// End score music functions.'));
const context=vm.createContext({});vm.runInContext(pure,context);
const {parseScoreChord:parse,transposeScoreChord:transpose,capoScoreChord:capo,detectScoreKey:detect,filterScoreWords:filter}=context;
const key=name=>{const c=parse(name);return {pc:c.root,minor:c.minor};};
assert.equal(capo('G',1,key('G')),'F#');
assert.equal(capo('C/E',1,key('C')),'B/D#');
assert.equal(capo('Gm/Bb',1,key('Gm')),'F#m/A');
assert.equal(transpose('Gm/Bb',2,key('Am')),'Am/C');
assert.equal(transpose('D7sus4',1,key('Eb')),'Eb7sus4');
assert.equal(transpose('Am7',-2,key('G')),'Gm7');
assert.equal(transpose('C/E',-1,key('B')),'B/D#');
assert.equal(transpose('G',1,key('Ab')),'Ab');
assert.equal(transpose('G',-1,key('F#')),'F#');
assert.equal(transpose('Gm/Bb',0,key('Gm')),'Gm/Bb');
assert.equal(transpose('B♭maj7/F',2,key('C')),'Cmaj7/G');
assert.equal(transpose('F♯m7',0,key('F#m')),'F#m7');
for(const name of ['G','C/E','Gm/Bb','D7sus4','Am7','C7(b9)','F#m7b5','Cadd9','C5','Aaug','Bdim7','CM7','C6/9']){
if(name==='C6/9'){assert.equal(parse(name),null);continue;}
assert(parse(name),name);
for(let n=-11;n<=11;n++){
const result=transpose(name,n,key('C')),back=transpose(result,-n,key('C'));
assert.equal(parse(back).root,parse(name).root);
assert.equal(parse(back).bass,parse(name).bass);assert.equal(parse(back).suffix,parse(name).suffix);
}
}
for(const value of ['', 'Amazing', 'Capo','Bridge','Amor','Guitar','H7','C//E','C()','Gmm','Cmajmaj','C/Eb/G',null,'<img>'])assert.equal(parse(value),null,String(value));
for(const fret of [-1,12,1.5])assert.equal(capo('G',fret,key('G')),null);
assert.equal(transpose('G',NaN),null);
assert.equal(detect([]),null);
assert.equal(detect(['G','C','D7','G']).name,'G');
assert.equal(detect(['Am','Dm','E7','Am']).name,'Am');
assert.equal(detect(['Bb','Eb','F7','Bb']).name,'Bb');
assert.equal(detect(['C','G','Am','F','C']).name,'C');
const word=(text,x,y,h=18,confidence=95)=>({text,confidence,bbox:{x0:x,y0:y,x1:x+35,y1:y+h}});
const words=[word('G',50,200),word('C/E',300,200),word('D7sus4',50,400),word('Am7',300,400),word('G',500,5,65),word('C',50,500,18,10),word('G',50,600),word('sing',100,600),word('along',180,600),word('A',50,20),word('Bm',50,720,1),word('Em',-1,800)];
assert.deepEqual(Array.from(filter(words,1000,1000),w=>w.text),['G','C/E','D7sus4','Am7']);
// OCR repairs stay separate from manual input parsing, and never guess a bare 0.
const {normalizeScoreOCR:normalize,scoreImageSize:imageSize,resizeScorePixels:resize,preprocessScorePixels:preprocess,scoreOCRWords:ocrWords,mergeScoreOCR:merge}=context;
for(const [raw,expected] of [[' B♭m7 / F♯ ','Bbm7/F#'],['F＃m7','F#m7'],['G∕B','G/B'],['G\\B','G/B'],['Bb','Bb'],['bm7','Bm7'],['CM1','CM7'],['Cml','Cm7'],['DIl','D11'],['C1','C7'],['0m7','Dm7'],['07','D7'],['CM7','CM7'],['Cm7','Cm7'],['D7sus4','D7sus4'],['C13','C13'],['G7/B','G7/B']])assert.equal(normalize(raw),expected,raw);
for(const raw of ['0','O','1','l','7','a','sing','Amazing','C/0','C/1','C118','Gmumble',null])assert.equal(normalize(raw),null,String(raw));
assert.equal(parse('CM1'),null,'Manual chord input must not use OCR guesses');
assert.deepEqual({...imageSize(437,585,true)},{width:1311,height:1755});
assert.deepEqual({...imageSize(1800,1000,true)},{width:3286,height:1826});
assert.deepEqual({...imageSize(8000,4000)},{width:4096,height:2048});
for(const [w,h] of [[4000,3000],[8000,8000],[1,8000],[8000,1]]){
const size=imageSize(w,h,true);assert(Math.max(size.width,size.height)<=4096);assert(size.width*size.height<=6005000);
}
const pixels=(w,h,fn)=>({width:w,height:h,data:Uint8ClampedArray.from(Array.from({length:w*h},(_,p)=>[...fn(p%w,Math.floor(p/w)),255]).flat())});
const colorful=pixels(4,1,x=>[[210,15,15],[240,130,15],[20,20,20],[245,245,245]][x]);
const before=Array.from(colorful.data),mask=preprocess(colorful,'color');
assert.deepEqual([0,1,2,3].map(p=>mask.data[p*4]),[0,0,255,255],'Color mask drops neutral staff/lyrics while keeping red and orange');
assert.deepEqual(Array.from(colorful.data),before,'Variants must not mutate shared color pixels');
assert.equal(preprocess(pixels(1,1,()=>[15,70,200]),'color').data[0],0,'Blue chords also survive');
const alpha={width:1,height:1,data:Uint8ClampedArray.from([0,0,0,0])};
assert.deepEqual(Array.from(resize(alpha,2,2).data),Array(16).fill(255),'Transparent backgrounds become white');
const scaled=resize(pixels(2,1,x=>x?[255,255,255]:[0,0,0]),6,3);
assert.equal(scaled.width,6);assert.equal(scaled.height,3);assert(scaled.data[8]>0&&scaled.data[8]<255,'Upscaling interpolates edges');
const shaded=pixels(90,30,(x,y)=>{const paper=x<45?150:240,ink=(x===15||x===65)&&y>=10&&y<=20;return Array(3).fill(ink?paper-65:paper);});
const binary=preprocess(shaded,'adaptive'),gray=preprocess(shaded,'gray');
for(const x of [15,65])assert.equal(binary.data[(15*90+x)*4],0,'Ink survives across unequal lighting');
for(const x of [30,80])assert.equal(binary.data[(15*90+x)*4],255,'Unequal paper backgrounds stay white');
assert(gray.data[(15*90+15)*4]<gray.data[(15*90+30)*4]);
assert(binary.data.every((v,i)=>i%4===3?v===255:v===0||v===255));
// Region grouping preserves nearby glyphs and separates distant chords from neutral staff.
const redScore=pixels(200,200,(x,y)=>y>=60&&y<68&&((x>=20&&x<24)||(x>=26&&x<30)||(x>=90&&x<94))?[190,20,20]:[240,240,240]);
const regions=context.scoreRedRegions(redScore);
assert.deepEqual(Array.from(regions,b=>[b.x0,b.y0,b.x1,b.y1]),[[20,60,30,68],[90,60,94,68]]);
const screenshot=pixels(200,200,(x,y)=>(((y>=60&&y<68)||(y>=120&&y<128))&&((x>=20&&x<24)||(x>=90&&x<94)))||((y>=20&&y<28||y>=170&&y<178)&&x>=50&&x<54)?[190,20,20]:[255,255,255]);
assert.equal(context.scoreRedRegions(screenshot).length,4,'Repeated chord rows exclude screenshot logos and controls');
const crop=context.scoreRegionPixels(redScore,regions[0]);
assert.equal(crop.width,88);assert.equal(crop.height,80);
assert.equal(normalize('A/C♯'),'A/C#');assert.equal(normalize('Gm/B♭'),'Gm/Bb');
assert.equal(normalize('D73us4'),'D7sus4');assert.equal(normalize('G'),'G');assert.equal(normalize('C'),'C');
// Scaled coordinates, split suffixes and slash tokens are folded before bbox deduplication.
const split=[word('B',150,600),{...word('b',187,600),bbox:{x0:187,y0:600,x1:198,y1:618}},word('G',500,600),{...word('/',537,600),bbox:{x0:537,y0:600,x1:545,y1:618}},word('B',547,600)];
const candidates=ocrWords(split,{width:3000,height:3000},{width:1000,height:1000},'gray');
const merged=merge(candidates);
assert.deepEqual(Array.from(merged,c=>c.text),['Bb','G/B']);
assert.equal(merged[0].bbox.x0,50);assert.equal(merged[0].bbox.x1,66);
const duplicate=word('CM7',50,200,18,85),short=word('C',50,201,17,88),repeat=word('CM7',350,200,18,80);
assert.deepEqual(Array.from(merge([short,duplicate,{...duplicate,variant:'color'},repeat]),c=>c.text),['CM7','CM7'],'Repeated occurrences survive; overlapping partial/conflicting OCR does not');
const uncertain=[word('Am7',50,200,18,35)];
assert.equal(ocrWords(uncertain,{width:1000,height:1000},{width:1000,height:1000},'gray').length,0);
assert.equal(ocrWords(uncertain,{width:1000,height:1000},{width:1000,height:1000},'color').length,1);
assert.deepEqual(Array.from(merge([word('G/B',350,198),word('CM7',50,200)]),c=>c.text),['CM7','G/B'],'Read a chord row from left to right despite differing glyph heights');

// No browser: execute actual UI wiring with small DOM/canvas doubles.
class Element{
constructor(){this.children=[];this.value='';this.style={};this.dataset={};this.handlers={};this.classList={toggle(){}};this.hidden=false;}
append(...children){this.children.push(...children);}
replaceChildren(...children){this.children=children;}
setAttribute(name,value){this[name]=value;}
addEventListener(name,handler){this.handlers[name]=handler;}
remove(){} close(){} showModal(){} focus(){}
getContext(){return painter;}
}
const paint=[];
const painter={drawImage(...a){paint.push(['image',...a]);},getImageData(_x,_y,w=1,h=1){return {data:new Uint8ClampedArray(w*h*4).fill(255)};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){},measureText(text){return {width:text.length*12};},fillRect(...a){paint.push(['mask',...a]);},fillText(...a){paint.push(['text',...a]);}};
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
$('score-key-select').value='auto';
const head=new Element(),ui=script.slice(script.indexOf('// Score editor: images'),script.indexOf('// Mode hashes are routes'));
Object.assign(context,{painter,$,document:{createElement:()=>new Element(),head,querySelectorAll:()=>[]},window:{},navigator:{onLine:true},setTimeout,clearTimeout,localStorage:{getItem:()=>null}});
vm.runInContext(ui,context);
assert.equal(head.children.length,0,'OCR must not download at app startup');
context.openScoreTab();assert.equal(head.children.length,0,'Guide alone must not download OCR');
assert.equal($('score-frets').children.length,12);
vm.runInContext("scoreState.source={width:1000,height:1000,getContext:()=>({getImageData:()=>({data:[255,255,255,255]})})};scoreState.image={};scoreState.codes=[{text:'G',bbox:{x0:50,y0:200,x1:85,y1:218}}];scoreState.capo=1;",context);
context.drawScore(new Element(),false);
assert(paint.some(call=>call[0]==='text'&&call[1]==='F#'));
assert(paint.some(call=>call[0]==='mask'&&call[2]===198),'Replacement covers original bbox');
paint.length=0;context.drawScore(new Element(),true);assert.deepEqual(paint.map(p=>p[0]),['image']);
paint.length=0;vm.runInContext("scoreState.overlay='above'",context);context.drawScore(new Element(),false);
assert(paint.find(p=>p[0]==='text')[3]<200,'Above mode draws above original chord');
async function checkOCR(){
let regionPSM,regionCalls=0;
const regionResult=await context.runScoreOCRPasses({setParameters:async p=>{regionPSM=p.tessedit_pageseg_mode;},recognize:async()=>{
if(regionPSM==='11')return {data:{words:[]}};
return {data:{text:regionCalls++?'G':'Gm/B♭',confidence:90}};
}},redScore,image=>image);
assert.deepEqual(Array.from(regionResult,w=>w.text),['Gm/Bb','G']);
assert.equal(regionCalls,2,'Single-character chords survive region OCR without a neighbouring chord');

let params,terminated=0,recognized=0;const progress=[];
vm.runInContext("scoreState.source={width:300,height:300,getContext:()=>painter}",context);
context.window.Tesseract={createWorker:async(lang,oem,options,config)=>{
assert.equal(lang,'eng');assert(options.workerPath.startsWith('https://cdn.jsdelivr.net/'));assert.equal(config.load_system_dawg,'0');
return {setParameters:async p=>{params=p;},recognize:async canvas=>{assert.equal(canvas.width,900);assert.equal(canvas.height,900);recognized++;options.logger({status:'recognizing text',progress:.5});progress.push($('score-status').textContent);return {data:{words:[word('G',90,270,30),word('D7',600,270,30)]}};},terminate:async()=>{terminated++;}};
}};
await context.recognizeScore();
assert(params.tessedit_char_whitelist.includes('♭♯'));assert.equal(params.tessedit_pageseg_mode,'11');assert.equal(recognized,3);assert.equal(terminated,1);
assert.deepEqual(progress.map(text=>text.match(/(\d+)%/)[1]),['17','50','83']);
assert.equal(vm.runInContext('scoreState.codes.length',context),2);
assert.equal($('score-file').disabled,false);
assert($('score-code-list').children.every(b=>!b.disabled),'Editing enabled after OCR finishes');
context.navigator.onLine=false;await context.recognizeScore();assert.equal(recognized,3);assert.match($('score-status').textContent,/오프라인/);
context.navigator.onLine=true;context.window.Tesseract.createWorker=async()=>{throw Error('unavailable');};
await context.recognizeScore();assert.match($('score-status').textContent,/직접 추가/);assert.equal($('score-add').disabled,false);
assert.equal(vm.runInContext('scoreState.codes.length',context),2,'Failed retry keeps previous edits');
// Cancelled work cannot replace manual edits, or disable controls after a new job.
let finish;
context.window.Tesseract.createWorker=async()=>({setParameters:async()=>{},recognize:()=>new Promise(resolve=>{finish=resolve;}),terminate:async()=>{}});
const pending=context.recognizeScore();
for(let i=0;i<30&&!finish;i++)await new Promise(resolve=>setTimeout(resolve,0));
assert(finish);context.cancelScoreOCR();
finish({data:{words:[]}});await pending;
assert.equal(vm.runInContext('scoreState.codes.length',context),2);
assert.equal($('score-add').disabled,false);
// Library download fails cleanly and can be retried.
delete context.window.Tesseract;
const loading=context.loadScoreLibrary();assert.equal(head.children.length,1);head.children[0].onerror();await assert.rejects(loading);
const retry=context.loadScoreLibrary();context.window.Tesseract={};head.children[1].onload();await retry;
assert.equal(head.children.length,2);
// File validation and downscaling use the same dimensions as OCR and export.
$('score-file').files=[{type:'image/gif',size:100}];
await $('score-file').handlers.change();assert.match($('score-status').textContent,/20MB/);
$('score-file').files=[{type:'image/png',size:20*1024*1024+1}];
await $('score-file').handlers.change();assert.match($('score-status').textContent,/20MB/);
let revoked=0;
context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked++;}};
context.Image=class {constructor(){this.naturalWidth=8000;this.naturalHeight=4000;}set src(value){Promise.resolve().then(()=>this.onload());}};
context.navigator.onLine=false;
$('score-file').files=[{type:'image/png',size:20*1024*1024}];
await $('score-file').handlers.change();
assert.equal(vm.runInContext('scoreState.source.width',context),4096);
assert.equal(vm.runInContext('scoreState.source.height',context),2048);
assert.equal($('score-work').hidden,false);assert.equal($('score-add').disabled,false);assert.equal(revoked,1);
}
checkOCR().then(()=>console.log('Score transposition, capo, keys, OCR filters, rendering, lazy load, cancellation and manual fallback passed (no browser).')).catch(error=>{console.error(error);process.exitCode=1;});
