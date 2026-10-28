// A small wrapper around the installed BB-Video native renderer.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(process.env.BB_VIDEO_SKILL_DIR||path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','bb-video'));
const native=path.join(skill,'promo/scripts/render.mjs');
if(!fs.existsSync(native))throw Error('Install BB-Video or configure BB_VIDEO_SKILL_DIR.');
if(!fs.existsSync(path.join(root,'prepared.json')))throw Error('Run node videos/loneliness-bbvideo/prepare.mjs first.');
const candidates=[String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'];
const chrome=process.env.CHROME_PATH||candidates.find(p=>fs.existsSync(p));if(!chrome)throw Error('Configure CHROME_PATH to a local Chrome/Chromium executable.');
const args=process.argv.slice(2);for(const [name,value]of [['workers','1'],['blur','1']])if(!args.includes('--'+name))args.push('--'+name,value);
for(const flag of ['--no-audio','--offline'])if(!args.includes(flag))args.push(flag);
const result=spawnSync(process.execPath,[native,root,...args],{stdio:'inherit',windowsHide:true,env:{...process.env,CHROME_PATH:chrome}});
if(result.error)throw result.error;process.exitCode=result.status??1;
