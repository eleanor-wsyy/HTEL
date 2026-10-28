import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),profile=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-bb-audit-'));
const chrome=process.env.CHROME_PATH||[String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`].find(f=>fs.existsSync(f));
if(!chrome)throw Error('Configure CHROME_PATH to the local Chrome/Chromium executable.');
const proc=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws,closeBrowser;
try{
 const url=await new Promise((resolve,reject)=>{let b='';const tm=setTimeout(()=>reject(Error('Chrome launch timeout')),30000);proc.stderr.on('data',c=>{b+=c;const m=b.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(tm);resolve(m[1])}});proc.on('error',reject)});
 ws=new WebSocket(url);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 let id=0;const pending=new Map(),listeners=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}else listeners.forEach(f=>f(m))});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}))});
 closeBrowser=()=>send('Browser.close');
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const S=(m,p)=>send(m,p,sessionId);await S('Page.enable');await S('Runtime.enable');await S('Page.addScriptToEvaluateOnNewDocument',{source:'window.__RENDER__=true;window.__BV_LANG="zh";'});await S('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 const load=new Promise(resolve=>listeners.push(m=>{if(m.method==='Page.loadEventFired'&&m.sessionId===sessionId)resolve()}));await S('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});await load;
 const evaluate=async expression=>{const r=await S('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 await evaluate('window.__ready');const texts=await evaluate('window.__texts()'),data=await evaluate('window.ATLAS_DATA_CHECK()');
 const times=[.5,8,13,14.6,29,40,50,54,58,62,65,69,73,78,84,90,96,103,108,111,115,120,128,138,145,150,158,166,172,177];
 const overflow=[],overlap=[],samples=[];
 for(const t of times){await evaluate(`window.renderFrame(${t})`);const r=await evaluate('window.ATLAS_LAYOUT_AUDIT()');overflow.push(...r.overflow.map(b=>({time:t,...b})));const current=r.boxes.filter(b=>windowCheck(b,t));
  function windowCheck(b,t){const scene=({scope:[0,14],background:[14,31],atlas:[31,53],models:[53,81],missing:[81,100],person:[100,114],radial:[114,143],compare:[143,169],ending:[169,180]})[b.scene];return scene&&scene[0]<=t&&t<scene[1]}
  for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++){const a=current[i],b=current[j];const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(w>8&&h>8&&w*h>Math.min(a.w*a.h,b.w*b.h)*.18)overlap.push({time:t,a:a.text,b:b.text,w,h})}
  samples.push({t,textBoxes:current.length});
 }
 const out=path.join(root,'review');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'copy-audit.json'),JSON.stringify(texts,null,2));fs.writeFileSync(path.join(out,'layout-audit.json'),JSON.stringify({data,samples,overflow,overlap},null,2));
 const base=fs.readFileSync(path.join(root,'brief-base.md'),'utf8');fs.writeFileSync(path.join(root,'brief.md'),base+'\n\n## 逐项屏幕文案（图表数字由以上原始字段生成）\n\n'+texts.map(t=>'- '+t).join('\n')+'\n');
 console.log(JSON.stringify({data,samples:samples.length,texts:texts.length,overflow:overflow.length,overlap:overlap.length}));
}finally{
 if(closeBrowser)try{await Promise.race([closeBrowser(),new Promise(r=>setTimeout(r,1500))])}catch{}
 if(ws)ws.close();if(proc.exitCode===null)proc.kill();proc.stderr?.destroy();await new Promise(r=>setTimeout(r,500));
 const resolved=path.resolve(profile),tmp=path.resolve(os.tmpdir());if(path.dirname(resolved)===tmp&&path.basename(resolved).startsWith('atlas-bb-audit-'))try{fs.rmSync(resolved,{recursive:true,force:true})}catch{}
}
