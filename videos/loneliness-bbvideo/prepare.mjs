// Prepare only local generated inputs. No downloads and no Git operations.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../..');
if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22+ is required (tested with Node 24).');
const skill=path.resolve(process.env.BB_VIDEO_SKILL_DIR||path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','bb-video'));
const sources=[['core/runtime/core.js','lib/core.js'],['promo/runtime/promo.js','lib/promo.js'],['promo/runtime/swiss.js','lib/swiss.js']];
const regular=process.env.ATLAS_FONT_REGULAR||String.raw`C:\Windows\Fonts\Noto Sans SC (TrueType).otf`;
const bold=process.env.ATLAS_FONT_BOLD||String.raw`C:\Windows\Fonts\Noto Sans SC Bold (TrueType).otf`;
for(const [input]of sources)if(!fs.existsSync(path.join(skill,input)))throw Error(`BB-Video is not installed at ${skill}; install BubbleBrainBB/BB-Video or configure BB_VIDEO_SKILL_DIR.`);
for(const [env,file]of [['ATLAS_FONT_REGULAR',regular],['ATLAS_FONT_BOLD',bold]])if(!fs.existsSync(file))throw Error(`Configure ${env} to a local Chinese OpenType font. Missing: ${file}`);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
const sha=(buffer)=>crypto.createHash('sha256').update(buffer).digest('hex');
for(const [name,expected]of Object.entries(manifest.data)){
 let input=fs.readFileSync(path.join(repo,name));if(name.endsWith('.js'))input=Buffer.from(input.toString('utf8').replace(/\r\n/g,'\n'));
 if(sha(input)!==expected)throw Error(`Movie snapshot differs from repository input: ${name}. Review/recompute data and update provenance before regenerating.`);
}
const study=JSON.parse(fs.readFileSync(path.join(repo,'data/study.json'),'utf8'));
const modelText=fs.readFileSync(path.join(repo,'figma-model-data.js'),'utf8'),marker='export const figmaModels = ';
const models=JSON.parse(modelText.split(marker)[1].trim().replace(/;$/,''));
if(study.people.length!==515||models.reduce((n,m)=>n+m.barCount,0)!==28019)throw Error('Unexpected cohort or model data.');
const refresh=process.argv.includes('--refresh');
function generated(dest,content){const target=path.join(root,dest);fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=Buffer.isBuffer(content)?content:Buffer.from(content);if(fs.existsSync(target)&&!fs.readFileSync(target).equals(bytes)&&!refresh)throw Error(`Generated file differs: ${dest}. Preserve local edits or explicitly rerun with --refresh.`);fs.writeFileSync(target,bytes);}
for(const [from,to]of sources)generated(to,fs.readFileSync(path.join(skill,from)));
generated('assets/fonts/AtlasSans-Regular.otf',fs.readFileSync(regular));generated('assets/fonts/AtlasSans-Bold.otf',fs.readFileSync(bold));
const data={meta:study.meta,people:study.people,metrics:study.metrics,referenceMeans:study.referenceMeans,models};
generated('assets/data.js','window.ATLAS_DATA = '+JSON.stringify(data)+';\n');
fs.writeFileSync(path.join(root,'prepared.json'),JSON.stringify({node:process.version,skill,dataHashes:manifest.data,runtimes:Object.fromEntries(sources.map(([from,to])=>[to,sha(fs.readFileSync(path.join(skill,from)))]))},null,2));
console.log('Prepared local BB-Video runtimes, fonts and canonical data. Nothing downloaded.');
