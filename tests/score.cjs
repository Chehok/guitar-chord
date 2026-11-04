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
const painter={drawImage(...a){paint.push(['image',...a]);},getImageData(){return {data:[255,255,255,255]};},measureText(text){return {width:text.length*12};},fillRect(...a){paint.push(['mask',...a]);},fillText(...a){paint.push(['text',...a]);}};
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
$('score-key-select').value='auto';
const head=new Element(),ui=script.slice(script.indexOf('// Score editor: images'),script.indexOf('// Mode hashes are routes'));
Object.assign(context,{$,document:{createElement:()=>new Element(),head,querySelectorAll:()=>[]},window:{},navigator:{onLine:true},setTimeout,clearTimeout,localStorage:{getItem:()=>null}});
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
let params,terminated=0,recognized=0;
context.window.Tesseract={createWorker:async(lang,oem,options)=>{
assert.equal(lang,'eng');assert(options.workerPath.startsWith('https://cdn.jsdelivr.net/'));
return {setParameters:async p=>{params=p;},recognize:async()=>{recognized++;return {data:{words:[word('G',50,200),word('D7',300,200)]}};},terminate:async()=>{terminated++;}};
}};
await context.recognizeScore();
assert(params.tessedit_char_whitelist.includes('♭♯'));assert.equal(recognized,1);assert.equal(terminated,1);
assert.equal(vm.runInContext('scoreState.codes.length',context),2);
assert.equal($('score-file').disabled,false);
assert($('score-code-list').children.every(b=>!b.disabled),'Editing enabled after OCR finishes');
context.navigator.onLine=false;await context.recognizeScore();assert.equal(recognized,1);assert.match($('score-status').textContent,/오프라인/);
context.navigator.onLine=true;context.window.Tesseract.createWorker=async()=>{throw Error('unavailable');};
await context.recognizeScore();assert.match($('score-status').textContent,/직접 추가/);assert.equal($('score-add').disabled,false);
assert.equal(vm.runInContext('scoreState.codes.length',context),2,'Failed retry keeps previous edits');
// Cancelled work cannot replace manual edits, or disable controls after a new job.
let finish;
context.window.Tesseract.createWorker=async()=>({setParameters:async()=>{},recognize:()=>new Promise(resolve=>{finish=resolve;}),terminate:async()=>{}});
const pending=context.recognizeScore();
for(let i=0;i<8&&!finish;i++)await Promise.resolve();
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
