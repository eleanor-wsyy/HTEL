import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coverageThreshold,coverageGroups,coverageBins,coverageFields,coverageComparison,observedDays} from '../coverage.js';
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
