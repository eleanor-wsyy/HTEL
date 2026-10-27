import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sgSchema,sgValue,sgFilter,sgClean,buildSankeyModel,sgRibbonPath,sgNodeBoxes} from '../sankey-data.js';
const {people}=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
const model=buildSankeyModel(people);
test('six-dimensional overlay agrees with all 31 original node counts',()=>{
 assert.equal(model.aligned,true);assert.equal(model.nodes.length,31);assert.equal(model.flows.length,283);
 for(const f of sgSchema){const nodes=model.nodes.filter(n=>n.key===f.key);assert.deepEqual(nodes.map(n=>n.n),f.expected);assert.equal(nodes.reduce((s,n)=>s+n.n,0),515);for(const n of nodes){assert.equal(n.used,n.n);const b=sgNodeBoxes(n);for(const r of Object.values(b))for(const v of Object.values(r))assert.ok(Number.isFinite(v));}}
});
test('every ribbon retains real identities, dimensions and finite coordinates',()=>{
 assert.equal(new Set(model.flows.flatMap(f=>f.ids)).size,515);assert.equal(model.flows.reduce((s,f)=>s+f.ids.length,0),515);
 for(const flow of model.flows){const filters=Object.fromEntries(sgSchema.map((f,i)=>[f.key,flow.labels[i]]));assert.deepEqual(new Set(sgFilter(people,filters).map(p=>p.id)),new Set(flow.ids));assert.ok(!/NaN|Infinity|undefined/.test(sgRibbonPath(flow)));}
});
test('category filters use intersection, handle missing reports and reject invalid fields',()=>{
 assert.equal(sgFilter(people,{}).length,515);assert.equal(sgFilter(people,{gender:'男性'}).length,116);
 const chosen=sgFilter(people,{gender:'女性',living:'独居'});assert.ok(chosen.length>0&&chosen.length<104);assert.ok(chosen.every(p=>p.profile.gender==='女性'&&p.profile.living==='独居'));
 assert.equal(sgFilter(people,{gender:'未报告'}).length,3);assert.deepEqual(sgClean({gender:'错误',invalid:'任意'}),{});
 const zero=model.flows.find(f=>sgFilter(people,{gender:'未报告',relationship:f.labels[0],income:f.labels[4]}).length===0);assert.ok(zero);
 assert.equal(sgFilter(people,{gender:'未报告',relationship:zero.labels[0],income:zero.labels[4]}).length,0);
 for(const p of people)assert.ok(sgSchema.find(f=>f.key==='age').values.includes(sgValue(p,'age')));
});
test('mismatched data cannot silently receive the original image click overlay',()=>{assert.equal(buildSankeyModel(people.slice(1)).aligned,false);});
