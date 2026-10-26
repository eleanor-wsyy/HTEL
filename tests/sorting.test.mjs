import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sortPeople,sortOptions} from '../sorting.js';
const data=JSON.parse(await readFile(new URL('../data/study.json',import.meta.url),'utf8'));
const person=(id,age,mean,profile={})=>({id,mean,stats:[{mean:10-mean}],profile:{age,...profile}});
test('numeric sorting retains zero, puts missing last and breaks ties by id',()=>{
 const people=[person(3,null,null),person(2,30,0),person(1,30,5),person(4,70,5)];
 assert.deepEqual(sortPeople(people,'high').map(p=>p.id),[1,4,2,3]);
 assert.deepEqual(sortPeople(people,'low').map(p=>p.id),[2,1,4,3]);
 assert.deepEqual(sortPeople(people,'age').map(p=>p.id),[4,1,2,3]);
 assert.deepEqual(people.map(p=>p.id),[3,2,1,4]);
});
test('age is primary and living is secondary; living plus id groups before numbering',()=>{
 const people=[person(1,30,1,{living:'与家人／伴侣同住'}),person(2,30,1,{living:'独居'}),person(3,70,1,{living:'与朋友／室友同住'})];
 assert.deepEqual(sortPeople(people,'age-living').map(p=>p.id),[3,2,1]);
 assert.deepEqual(sortPeople(people,'living-id').map(p=>p.id),[2,1,3]);
});
test('income bins use economic order, not alphabetical or lexical order',()=>{
 const labels=['未报告','低于 $9,999','$10,000 - $19,999','$20,000 - $39,999','$40,000 – $59,999','$60,000 – $79,000','$80,000 – $99,999','超过 $100,000'];
 const people=labels.map((income,id)=>person(id,30,0,{income}));
 assert.deepEqual(sortPeople(people,'income').map(p=>p.id),[7,6,5,4,3,2,1,0]);
});
test('parent groups combine co-resident and non-resident parents; single and parent can overlap',()=>{
 const people=[person(1,30,2,{parent:'有子女且同住',relationship:'单身'}),person(2,30,8,{parent:'有子女但不同住',relationship:'已婚'}),person(3,30,9,{parent:'无子女',relationship:'有伴侣'}),person(4,30,10,{parent:'未报告',relationship:'未报告'})];
 assert.deepEqual(sortPeople(people,'parent').map(p=>p.id),[2,1,3,4]);
 assert.deepEqual(sortPeople(people,'single').map(p=>p.id),[1,3,2,4]);
 assert.deepEqual(sortPeople(people,'parent','single').map(p=>p.id),[1,2,3,4]);
});
test('all sort modes retain all 515 identities and the selected 27 cohort',()=>{
 for(const [mode] of sortOptions){
  assert.deepEqual(sortPeople(data.people,mode).map(p=>p.id).sort(),data.people.map(p=>p.id).sort());
  const featured=data.people.filter(p=>p.featured);
  assert.equal(sortPeople(featured,mode,'single').length,27);
 }
 const ordered=sortPeople(data.people,'high');
 assert.equal(ordered.at(-1).id,1117);
 for(let i=1;i<ordered.length-1;i++)assert.ok(ordered[i-1].mean>=ordered[i].mean);
});
