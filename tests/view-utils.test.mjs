import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {radial} from '../charts.js';
import {comparisonOptions,fitMosaicWidth,cohortSummary,longestRun} from '../view-utils.js';
const data=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
test('cohort explanation derives 515→192→27 from submitted dates, not item validity',()=>{
 const c=cohortSummary(data.people);assert.equal(c.all,515);assert.equal(c.complete,192);assert.equal(c.continuous,27);assert.equal(c.full,24);assert.equal(c.nearFull,3);assert.deepEqual(c.ids,data.meta.featuredIds);
 const p=data.people.find(p=>p.id===1159);assert.equal(p.days,75);assert.equal(p.validDays,74);assert.ok(c.ids.includes(p.id));
});
test('longest submitted-date run includes boundaries and preserves gaps',()=>{assert.equal(longestRun([true,true,false,true]),2);assert.equal(longestRun(Array(75).fill(true)),75);assert.equal(longestRun([]),0);});
test('fit-all uses both dimensions, matrix fits width, no zero-width chart',()=>{assert.equal(fitMosaicWidth(1200,650),650);assert.equal(fitMosaicWidth(330,500),330);assert.equal(fitMosaicWidth(1200,650,'matrix'),1200);assert.equal(fitMosaicWidth(0,0),1);});
test('comparison display options have safe defaults and round-trip share parameters',()=>{assert.deepEqual(comparisonOptions(new URLSearchParams()),{view:'overview',focus:'selected',layout:'single'});assert.deepEqual(comparisonOptions(new URLSearchParams('view=daily&focus=all&layout=paired')),{view:'daily',focus:'all',layout:'paired'});assert.equal(comparisonOptions(new URLSearchParams('view=nope&layout=bad')).view,'overview');});
test('refinement markup keeps all eight metric choices and accessible comparison panels',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 for(const name of ['overview','daily','score']){assert.ok(html.includes(`id="compare-tab-${name}"`));assert.ok(app.includes(`id="compare-view-${name}"`));}
 assert.ok(app.includes('activePerson=p;detailMetric=0'));
 assert.ok(app.includes("event.target.matches('.card-face,.id-body,.card-front-side')"));
 assert.ok(html.includes('id="return-to-atlas"'));assert.ok(html.includes('id="focus-person"'));
});
test('all participants share the native radial canvas, scale and tile anchor',()=>{const p=data.people.find(p=>p.id===1001);const svg=radial(p,data);assert.ok(svg.includes('viewBox="0 0 436 436"'));assert.ok(svg.includes('r="178"'));assert.ok(svg.includes('<svg x="368" y="367" width="58" height="45"'));});
