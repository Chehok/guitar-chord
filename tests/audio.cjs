'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const code=script.slice(script.indexOf('let audioContext=null,playing=[];'),script.indexOf("$('play').addEventListener"));
function make(contexts,audioSession){
  const made=[];
  class Ctx{constructor(){const spec=contexts.shift()||{};this.state=spec.initial||'suspended';this.spec=spec;made.push(this);}
    resume(){if(this.spec.hang)return new Promise(()=>{});if(this.spec.resumeTo)this.state=this.spec.resumeTo;return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}}
  const sandbox={window:{AudioContext:Ctx},navigator:{audioSession},setTimeout:(fn)=>global.setTimeout(fn,5)};
  vm.runInNewContext(code+';this.prepareAudio=prepareAudio;this.getCtx=()=>audioContext;this.audioFailure=audioFailure;',sandbox);
  return {sandbox,made};
}
(async()=>{
  // first tap: suspended context resumes and iOS audio session is marked as playback
  let session={type:'auto'};
  let t=make([{resumeTo:'running'}],session);
  assert.equal((await t.sandbox.prepareAudio()).state,'running');assert.equal(session.type,'playback');
  // already running: reused for repeat taps
  const first=t.sandbox.getCtx();await t.sandbox.prepareAudio();assert.equal(t.sandbox.getCtx(),first);assert.equal(t.made.length,1);
  // interrupted after backgrounding and never resuming: a fresh context is built
  t=make([{initial:'running'},{resumeTo:'running'},{resumeTo:'running'}],session);await t.sandbox.prepareAudio();
  t.made[0].state='interrupted';t.made[0].spec.hang=true;
  const again=await t.sandbox.prepareAudio();assert.equal(t.made.length,2);assert.equal(again.state,'running');assert.equal(t.made[0].state,'closed');
  // closed context is replaced
  t.sandbox.getCtx().state='closed';await t.sandbox.prepareAudio();assert.equal(t.made.length,3);
  // never running: rejects so the UI shows a failure, never success
  t=make([{hang:true},{hang:true}],session);
  await assert.rejects(t.sandbox.prepareAudio(),/audio-not-running/);
  // missing Web Audio and missing/throwing audioSession APIs
  const none={window:{},navigator:{},setTimeout};vm.runInNewContext(code+';this.prepareAudio=prepareAudio;',none);
  await assert.rejects(none.prepareAudio(),/unsupported/);
  t=make([{resumeTo:'running'}],undefined);await t.sandbox.prepareAudio();
  const bad={set type(v){throw Error('x');},get type(){return 'auto';}};t=make([{resumeTo:'running'}],bad);await t.sandbox.prepareAudio();
  // source wiring
  assert.equal((html.match(/await prepareAudio\(\)/g)||[]).length,2,'chord and tuner buttons share the helper');
  assert.match(html,/setAudioSession\('auto'\);context=new Audio\(\)/,'mic start restores the automatic session');
  assert(!/\.play\(\)\s*;?\s*\}\s*\)\s*;?\s*\/\/ autoplay/.test(html));
  assert.match(html,/\[1,\.5,\.35,\.2\]\.forEach/);
  console.log('Audio preparation: resume, interrupted recovery, failure reporting and session type passed (mocked, no browser).');
})().catch(error=>{console.error(error);process.exitCode=1;});
