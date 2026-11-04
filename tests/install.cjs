'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.slice(html.indexOf('// Home-screen installation:'),html.indexOf("if('serviceWorker' in navigator"));
assert.match(html,/<button id="install-button"[^>]* hidden>/);
assert.match(html,/<form method="dialog"><button autofocus>닫기<\/button>/);
function setup(userAgent='',installed=false,legacyStandalone=false,maxTouchPoints=0){
  const handlers={},clicks={};
  const button={hidden:true,addEventListener:(name,fn)=>{clicks[name]=fn;}};
  const guide={open:false,showModal(){this.open=true;},close(){this.open=false;}};
  const media={matches:installed,addEventListener:(name,fn)=>{handlers.media=fn;}};
  vm.runInNewContext(script,{
    $:id=>id==='install-button'?button:guide,
    navigator:{userAgent,standalone:legacyStandalone,maxTouchPoints},
    window:{matchMedia:query=>{assert.equal(query,'(display-mode: standalone)');return media;},
      addEventListener:(name,fn)=>{handlers[name]=fn;}}
  });
  return {button,guide,media,handlers,click:()=>clicks.click(),offer(prompt=async()=>{},userChoice=Promise.resolve({outcome:'accepted'})){
    let prevented=false;
    handlers.beforeinstallprompt({preventDefault(){prevented=true;},prompt,userChoice});
    assert(prevented);
  }};
}
(async()=>{
  for(const ua of ['Desktop Chrome','Android Chrome']){
    const app=setup(ua);assert(app.button.hidden);
    let calls=0,resolveChoice;
    app.offer(async()=>{calls++;},new Promise(resolve=>{resolveChoice=resolve;}));
    assert(!app.button.hidden);
    const clicked=app.click();assert(app.button.hidden);
    await app.click();assert.equal(calls,1,'Prompt must only be used once');
    resolveChoice({outcome:'dismissed'});await clicked;assert(app.button.hidden);
    app.offer();assert(!app.button.hidden);
    app.handlers.appinstalled();assert(app.button.hidden);
    app.offer();assert(app.button.hidden,'Installed app must stay hidden');
  }
  const rejected=setup();rejected.offer(async()=>{throw Error('unavailable');});
  await rejected.click();assert(rejected.button.hidden);
  for(const [ua,touches] of [['iPhone Version/18 Safari',0],['iPad Safari',0],['iPod Safari',0],['Macintosh Version/18 Safari',5]]){
    const app=setup(ua,false,false,touches);
    assert(!app.button.hidden);await app.click();assert(app.guide.open);
    app.guide.close();assert(!app.guide.open);
    await app.click();app.media.matches=true;app.handlers.media();
    assert(app.button.hidden);assert(!app.guide.open);
    app.media.matches=false;app.handlers.media();assert(!app.button.hidden);
    app.handlers.appinstalled();assert(app.button.hidden);
    assert(setup(ua,false,true,touches).button.hidden);
  }
  for(const browser of ['CriOS','FxiOS','EdgiOS','OPiOS'])assert(setup(`iPhone ${browser} Safari`).button.hidden);
  assert(setup('Macintosh Safari',false,false,0).button.hidden);
  for(const ua of ['Android Chrome','Desktop Chrome','iPhone Safari']){
    const app=setup(ua,true);app.offer();assert(app.button.hidden);await app.click();assert(!app.guide.open);
  }
  console.log('Install prompt, iOS guide, browser exclusions and standalone lifecycle passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
