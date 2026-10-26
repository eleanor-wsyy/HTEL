import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mean,fmt,color,metricColor,correlation,segments,parseSelection,windowStats,scoreLayers,readRoute,displayId,escapeHTML} from '../data-utils.js';
import {radial,tile,avatar,timeline,scatter} from '../charts.js';
const data=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
const byId=new Map(data.people.map(p=>[p.id,p]));const ids=new Set(byId.keys());
test('515 unique participants, original keys retained',()=>{assert.equal(data.people.length,515);assert.equal(ids.size,515);assert.equal(data.order.length,515);assert.deepEqual(new Set(data.order),ids);assert.equal(displayId(1122),'122');assert.equal(byId.get(1122).displayId,'122');});
test('all 75-day windows, dates, and eight fields align',()=>{for(const p of data.people){assert.equal(p.heat.length,75);assert.equal(p.daily.length,75);assert.equal(p.dates.length,75);assert.ok(p.daily.every(row=>row.length===8));assert.equal(p.validDays,p.heat.filter(x=>x!==null).length);assert.ok(p.daily.flat().every(x=>x===null||(x>=0&&x<=10)));}});
test('source audit preserves missing, duplicate and excluded records',()=>{assert.equal(data.meta.sourceRows,28027);assert.equal(data.meta.validCompositeCells,27785);assert.equal(data.meta.missingCompositeCells,10840);assert.equal(data.meta.possibleCells,38625);assert.equal(data.meta.duplicatePersonDayExtraRows,7);assert.equal(data.meta.outsideWindowRows,1);assert.equal(data.people.reduce((n,p)=>n+p.validDays,0),27785);});
test('featured cohort matches all original 27 charts',()=>{const group=data.people.filter(p=>p.featured);assert.equal(group.length,27);assert.deepEqual(group.map(p=>p.id),data.meta.featuredIds);assert.equal(group.filter(p=>p.days===75).length,24);assert.equal(group.filter(p=>p.days===74).length,3);for(let i=0;i<8;i++)assert.ok(Math.abs(mean(group.map(p=>p.stats[i].mean))-data.referenceMeans[i])<.00002);});
test('statistics never equate null with zero',()=>{assert.equal(mean([null,null]),null);assert.equal(mean([0,null,2]),1);assert.equal(fmt(null),'—');assert.equal(fmt(0),'0.00');assert.notEqual(color(null),color(0));assert.equal(color(null),'#e4e7ec');assert.equal(color(10),'#10233f');});
test('all-missing participant remains in grid with no fabricated scores',()=>{const p=byId.get(1117);assert.equal(p.mean,null);assert.equal(p.validDays,0);assert.ok(p.heat.every(x=>x===null));});
test('derived means and SDs agree with serialized source',()=>{for(const p of data.people)for(let i=0;i<8;i++){const valid=p.daily.map(r=>r[i]).filter(x=>x!==null);const m=mean(valid);assert.equal(p.stats[i].n,valid.length);if(m===null)assert.equal(p.stats[i].mean,null);else assert.ok(Math.abs(m-p.stats[i].mean)<.00002);if(valid.length>1){const sd=Math.sqrt(valid.reduce((s,x)=>s+(x-m)**2,0)/(valid.length-1));assert.ok(Math.abs(sd-p.stats[i].sd)<.00002);}}});
test('total overview composite and archive single-item are kept distinct',()=>{const p=byId.get(1045);assert.equal(fmt(p.stats[0].mean),'6.76');assert.notEqual(fmt(p.mean),fmt(p.stats[0].mean));assert.equal(fmt(byId.get(1478).stats[0].mean),'3.44');assert.equal(fmt(byId.get(1498).stats[0].mean),'3.44');});
test('trajectory has explicit gaps and keeps day 1 and day 75',()=>{assert.deepEqual(segments([0,null,2,3,null]),[[[0,0]],[[2,2],[3,3]]]);const one=windowStats(byId.get(1122),0,75,75);assert.equal(one.values.length,1);assert.equal(one.values[0],byId.get(1122).daily[74][0]);const svg=timeline([byId.get(1122)],0);assert.ok(svg.includes('D01'));assert.ok(svg.includes('D75'));assert.ok(svg.includes('缺失日不连线'));});
test('window means exclude missing and include both boundaries',()=>{const p={daily:[[0],[null],[10]]};assert.deepEqual(windowStats(p,0,1,3),{mean:5,n:2,values:[0,null,10]});assert.deepEqual(windowStats(p,0,1,1),{mean:0,n:1,values:[0]});});
test('invalid and duplicate selections are removed, max 4',()=>{assert.deepEqual(parseSelection('1122,1122,1002,nope,999999,1045,1113,1498',ids),[1122,1002,1045,1113]);assert.deepEqual(parseSelection('',ids),[]);});
test('routes retain original IDs and safe malformed fallbacks',()=>{const r=readRoute('#archives?person=1122&flip=1',ids);assert.equal(r.person,1122);assert.equal(r.flipped,true);assert.equal(r.page,'archives');assert.equal(readRoute('#nothing?person=99999',ids).page,'home');assert.equal(readRoute('#archives?person=122',ids).person,null);assert.deepEqual(readRoute('#compare?ids=1478,1498',ids).selection,[1478,1498]);});
test('correlation excludes missing; constants have undefined r',()=>{assert.equal(correlation([[0,0],[1,1],[2,2],[null,3]]),1);assert.equal(correlation([[1,0],[1,1],[1,2]]),null);assert.equal(correlation([[0,0]]),null);});
test('integer loneliness strata do not fabricate empty samples',()=>{const a=scoreLayers(byId.get(1478)),b=scoreLayers(byId.get(1498));assert.equal(a.length,11);assert.equal(a[0].n,0);assert.equal(a[0].interaction,null);assert.equal(a[2].n,20);assert.equal(b[2].n,15);assert.equal(fmt(a[2].interaction),'5.80');assert.equal(fmt(b[2].interaction),'1.07');});
test('native radial uses original ID; mini tile is the same source symbol',()=>{const p=byId.get(1122);assert.ok(radial(p,data).includes('#radial-1122'));assert.ok(tile(p).includes('#tile-1122'));const generated=radial(p,data,{native:false});assert.ok(generated.includes('#tile-1122'));assert.ok(generated.includes('>122</text>'));assert.ok(!generated.includes('>1122</text>'));});
test('all missing dynamic chart has no fake rays',()=>{const p={...byId.get(1117),daily:Array.from({length:75},()=>Array(8).fill(null)),stats:Array.from({length:8},()=>({mean:null,sd:null,n:0}))};const svg=radial(p,data,{native:false});assert.ok(!svg.includes('<line'));assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('undefined'));});
test('all render functions avoid NaN and undefined on missing cases',()=>{for(const id of[1117,1122,1309,1478,1498]){const p=byId.get(id);for(const html of[radial(p,data),avatar(p),scatter(p),timeline([p],5)]){assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));}}});
test('raw CSV text is safely escaped for HTML',()=>{assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');});
test('SVG sprites contain all original tile and radial symbols',async()=>{const tiles=await readFile(new URL('../assets/tiles.svg',import.meta.url),'utf8'),radials=await readFile(new URL('../assets/radials.svg',import.meta.url),'utf8');assert.equal((tiles.match(/<symbol /g)||[]).length,515);assert.equal((radials.match(/<symbol /g)||[]).length,27);for(const p of data.people)assert.ok(tiles.includes(`id="tile-${p.id}"`));assert.ok(radials.includes('>122</text>'));assert.ok(!radials.includes('>1122</text>'));});

test('all eight day-grid palettes retain their radial metric hue',()=>{
 assert.equal(new Set(data.metrics.map(m=>m.color)).size,8);
 for(const m of data.metrics){
  assert.equal(metricColor(10,m.color),m.color);
  assert.notEqual(metricColor(0,m.color),metricColor(10,m.color));
  assert.notEqual(metricColor(0,m.color),metricColor(null,m.color));
  assert.equal(metricColor(null,m.color),'#e4e7ec');
  assert.equal(metricColor(NaN,m.color),'#e4e7ec');
  assert.equal(metricColor(-1,m.color),metricColor(0,m.color));
  assert.equal(metricColor(11,m.color),m.color);
 }
});
test('metric intensity darkens monotonically without changing numeric scores',()=>{
 for(const m of data.metrics){
  const brightness=c=>[1,3,5].reduce((sum,i)=>sum+parseInt(c.slice(i,i+2),16),0);
  const shades=Array.from({length:11},(_,v)=>brightness(metricColor(v,m.color)));
  for(let i=1;i<shades.length;i++)assert.ok(shades[i]<=shades[i-1]);
 }
 assert.equal(color(0),'#fff5ba');assert.equal(color(10),'#10233f');
});
test('native comparison radials focus all eight metrics without redrawing source charts',()=>{
 for(let metric=0;metric<8;metric++)for(const id of[1478,1498]){
  const svg=radial(byId.get(id),data,{selectedMetric:metric});
  assert.ok(svg.includes(`data-selected-metric="${metric}"`));
  assert.ok(svg.includes(`data-metric-color="${data.metrics[metric].color}"`));
  assert.equal((svg.match(new RegExp(`href="assets/radials.svg#radial-${id}"`,'g'))||[]).length,2);
  assert.ok(svg.includes('opacity=".16"'));
  assert.ok(svg.includes(`clip-path="url(#radial-focus-${id}-${metric})"`));
  assert.ok(svg.includes('<circle cx="218" cy="218" r="44"/>'));
  assert.ok(svg.includes('<rect x="368" y="367" width="58" height="45"/>'));
  assert.ok(svg.includes(`当前高亮 0${metric+1} ${data.metrics[metric].name}`));
 }
});
test('non-featured comparison radials emphasize one sector while retaining all eight',()=>{
 const person=byId.get(1001);
 for(let selectedMetric=0;selectedMetric<8;selectedMetric++){
  const svg=radial(person,data,{selectedMetric});
  assert.equal((svg.match(/class="radial-sector"/g)||[]).length,8);
  assert.equal((svg.match(/opacity="0.16"/g)||[]).length,7);
  assert.ok(svg.includes(`data-radial-metric="${selectedMetric}" opacity="1"`));
 }
});
test('unfocused archive and invalid selections preserve the original full-color radial',()=>{
 const p=byId.get(1478),original=radial(p,data);
 for(const selectedMetric of [null,-1,8,NaN,'3'])assert.equal(radial(p,data,{selectedMetric}),original);
 assert.ok(!original.includes('radial-focus-overlay'));
});
