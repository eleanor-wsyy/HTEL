import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const file=new URL('../dist/loneliness-atlas.html',import.meta.url);
const available=existsSync(file);
test('standalone embeds all original study data without a network loader',{skip:!available},async()=>{
 const html=await readFile(file,'utf8');const source=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
 const embedded=JSON.parse(html.match(/<script id="study-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.deepEqual(embedded,source);
 assert.equal((html.match(/<symbol\s/g)||[]).length,542);
 assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/<link[^>]+rel="stylesheet"/.test(html));
 assert.ok(!/(?:src|href)="assets\//.test(html));assert.ok(!html.includes('assets/tiles.svg#'));assert.ok(!html.includes('assets/radials.svg#'));
 const code=html.match(/<script id="standalone-app">([\s\S]*?)<\/script>/)[1];assert.ok(!code.includes('fetch('));assert.ok(!code.includes('import.meta'));assert.doesNotThrow(()=>new vm.Script(code));
});
test('standalone includes four complete vector posters and avoids duplicate archive IDs',{skip:!available},async()=>{
 const html=await readFile(file,'utf8'),code=html.match(/<script id="standalone-app">([\s\S]*?)<\/script>/)[1];
 const line=code.split(/\r?\n/).find(line=>line.startsWith('const POSTERS='));const posters=JSON.parse(line.slice('const POSTERS='.length,-1));assert.equal(Object.keys(posters).length,4);
 for(let i=1;i<=4;i++){assert.ok(posters[i].startsWith('data:image/svg+xml;base64,'));const svg=Buffer.from(posters[i].split(',')[1],'base64').toString('utf8');assert.equal(svg,await readFile(new URL(`../assets/poster-${i}.svg`,import.meta.url),'utf8'));}
 assert.ok(!/<g id="archive-\d+"/.test(html));assert.ok(html.includes('id="embedded-radials-archive-1478"'));
 assert.equal((html.match(/data-poster-image="[1-4]"/g)||[]).length,4);
});
test('standalone is built from the current sources, not a stale generated copy',{skip:!available},async()=>{
 const {createHash}=await import('node:crypto');const hash=createHash('sha256');
 const names=['index.html','styles.css','data/study.json','data-utils.js','sorting.js','charts.js','hero-motion.js','view-utils.js','coverage.js','coverage-view.js','research-stats.js','figma-model-data.js','figma-gallery.js','sankey-data.js','sankey-view.js','research-boards.js','app.js',...['tiles.svg','radials.svg','poster-1.svg','poster-2.svg','poster-3.svg','poster-4.svg'].map(n=>'assets/'+n),...(await readdir(new URL('../assets/figma/',import.meta.url))).filter(n=>n.endsWith('.png')).sort().map(n=>'assets/figma/'+n)];
 for(const name of names){hash.update(name+'\0');hash.update(await readFile(new URL('../'+name,import.meta.url)));}
 const html=await readFile(file,'utf8');assert.equal(html.match(/name="atlas-source-sha256" content="([^"]+)"/)[1],hash.digest('hex'));
});

test('standalone retains all 17 Figma original exports byte for byte',{skip:!available},async()=>{
 const html=await readFile(file,'utf8');const assets=JSON.parse(html.match(/<script id="figma-assets-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(Object.keys(assets).length,17);
 for(const [key,value] of Object.entries(assets))assert.deepEqual(Buffer.from(value.split(',')[1],'base64'),await readFile(new URL('../assets/figma/'+key+'.png',import.meta.url)));
});
