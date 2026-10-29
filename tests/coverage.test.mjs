import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coverageThreshold,coverageGroups,coverageBins,coverageFields,coverageComparison,observedDays,coverageEvidence} from '../coverage.js';
import {coverageMarkup} from '../coverage-view.js';
import {readRoute} from '../data-utils.js';
const {people}=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
test('low coverage counts valid composite days, including zero, not diary rows',()=>{
 assert.equal(observedDays({heat:[0,null,1,NaN,undefined]}),2);
 for(const p of people)assert.equal(observedDays(p),p.validDays);
 const {low,rest}=coverageGroups(people);assert.equal(low.length,49);assert.equal(rest.length,466);
 assert.ok(low.some(p=>p.id===1117));assert.equal(new Set([...low,...rest].map(p=>p.id)).size,515);
});
test('threshold sensitivity and histogram preserve the complete cohort',()=>{
 for(const [limit,n] of [[7,32],[15,49],[30,91]]){const {low,rest}=coverageGroups(people,limit);assert.equal(low.length,n);assert.equal(low.length+rest.length,515);assert.ok(low.every(p=>p.validDays<=limit));assert.ok(rest.every(p=>p.validDays>limit));}
 assert.equal(coverageBins(people).reduce((n,b)=>n+b.count,0),515);assert.equal(coverageThreshold('bad'),15);assert.equal(coverageThreshold(75),15);
});
test('demographic denominators include unknowns, each category partitions each group',()=>{
 const {low,rest}=coverageGroups(people);
 for(const field of coverageFields){const rows=coverageComparison(low,rest,field);assert.equal(rows.reduce((n,r)=>n+r.n,0),49);assert.equal(rows.reduce((n,r)=>n+r.other,0),466);assert.ok(Math.abs(rows.reduce((n,r)=>n+r.share,0)-1)<1e-10);}
 const gender=coverageComparison(low,rest,coverageFields[0]);assert.equal(gender.find(r=>r.label==='女性').n,29);assert.equal(gender.find(r=>r.label==='男性').n,15);
 assert.ok(coverageComparison([],[],coverageFields[0]).every(r=>r.share===null&&r.reference===null&&r.delta===null));
});
test('low coverage gallery reuses exact tile symbols and opens every selected person',()=>{
 const html=coverageMarkup(people,15);assert.equal((html.match(/class="coverage-person"/g)||[]).length,49);
 for(const p of coverageGroups(people).low){assert.ok(html.includes(`data-person="${p.id}"`));assert.ok(html.includes(`assets/tiles.svg#tile-${p.id}`));}
 assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});
test('outsider route retains threshold and profile state',()=>{
 const route=readRoute('#outsiders?threshold=7&person=1117&flip=1',new Set(people.map(p=>p.id)));assert.equal(route.page,'outsiders');assert.equal(route.person,1117);assert.equal(route.flipped,true);assert.equal(route.params.get('threshold'),'7');
});

test('coverage evidence reconciles missing cells and preserves demographic denominators',()=>{
 const e=coverageEvidence(people);
 assert.equal(e.low.n,49);assert.equal(e.rest.n,466);
 assert.equal(e.missing,3389);assert.equal(e.totalMissing,10840);
 assert.equal(e.noDiary,3317);assert.equal(e.incomplete,72);
 assert.equal(e.noDiary+e.incomplete,e.missing);
 assert.equal((e.missingShare*100).toFixed(1),'31.3');
 assert.equal(e.low.ageMedian,30.5);assert.equal(e.rest.ageMedian,37);
 assert.equal(e.low.lowerIncome,22);assert.equal(e.rest.lowerIncome,146);
 for(const p of people){assert.equal(p.days,p.dates.filter(Boolean).length);assert.ok(observedDays(p)<=p.days);}
});
test('sensitivity results recompute rather than retaining default-threshold findings',()=>{
 for(const [threshold,n,missing,noDiary,incomplete,ageLow,ageRest,incomeLow,incomeRest] of [[7,32,2304,2297,7,33,36,12,156],[15,49,3389,3317,72,30.5,37,22,146],[30,91,5562,5479,83,30,38,45,123]]){
  const e=coverageEvidence(people,threshold);
  assert.deepEqual([e.low.n,e.missing,e.noDiary,e.incomplete,e.low.ageMedian,e.rest.ageMedian,e.low.lowerIncome,e.rest.lowerIncome],[n,missing,noDiary,incomplete,ageLow,ageRest,incomeLow,incomeRest]);
  assert.ok(e.low.ageMedian<e.rest.ageMedian);assert.ok(e.low.lowerIncomeShare>e.rest.lowerIncomeShare);
  const html=coverageMarkup(people,threshold);assert.ok(html.includes(`${missing.toLocaleString('en-US')} 个灰格`));assert.ok(html.includes(`≤ ${threshold} 天 · 当前`));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
 }
 const empty=coverageEvidence([]);assert.equal(empty.missingShare,null);assert.equal(empty.low.ageMedian,null);assert.equal(empty.low.lowerIncomeShare,null);
});
test('overview gray-cell context links directly to coverage with a return path',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="overview-coverage-link" href="#outsiders\?threshold=15"/);
 assert.match(html,/class="coverage-backlink" href="#overview"/);
 const route=readRoute('#outsiders?threshold=15',new Set(people.map(p=>p.id)));assert.equal(route.page,'outsiders');assert.equal(coverageThreshold(route.params.get('threshold')),15);
});

test('animated coverage matrix preserves all person-days and recalculates every threshold',async()=>{const {coverageMatrixData}=await import('../coverage.js');const {coverageMatrixMarkup}=await import('../coverage-view.js');for(const t of [7,15,30]){const m=coverageMatrixData(people,t);assert.equal(m.columns.length,515);assert.equal(new Set(m.columns.map(c=>c.id)).size,515);assert.equal(m.columns.flatMap(c=>c.valid).length,38625);assert.equal(m.columns.reduce((n,c)=>n+c.days,0),27785);assert.equal(m.lowCount,m.columns.filter(c=>c.days<=t).length);assert.ok(m.columns.every((c,i)=>i===0||c.days>=m.columns[i-1].days));}const m=coverageMatrixData(people,15);assert.equal(m.lowCount,49);assert.equal((m.missingShare*100).toFixed(1),'31.3');const svg=coverageMatrixMarkup(people,15);assert.equal((svg.match(/data-cm-person=/g)||[]).length,515);assert.ok(!/<img|<image/.test(svg));});
