import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {figmaCharts,figmaColumnCells,figmaProjection} from '../figma-gallery.js';
import {figmaModels} from '../figma-model-data.js';
import {readRoute} from '../data-utils.js';
test('all 17 original chart exports retain their source file bytes and natural aspect ratio',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../docs/figma-chart-manifest.json',import.meta.url),'utf8'));
 assert.equal(figmaCharts.length,17);assert.equal(new Set(figmaCharts.map(c=>c[1])).size,17);
 for(const chart of figmaCharts){const bytes=await readFile(new URL('../assets/figma/'+chart[0]+'.png',import.meta.url));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const m=manifest.charts.find(m=>m.key===chart[0]);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);assert.equal(bytes.readUInt32BE(16),chart[3]);assert.equal(bytes.readUInt32BE(20),chart[4]);}
});
test('five model groups preserve all original columns and every missing cell',()=>{
 assert.deepEqual(figmaModels.map(g=>g.count),[192,14,242,38,29]);assert.deepEqual(figmaModels.map(g=>g.barCount),[13789,843,12656,651,80]);
 assert.equal(figmaModels.reduce((s,g)=>s+g.count,0),515);
 for(const g of figmaModels){assert.equal(g.rows.length,g.count);const cells=figmaColumnCells(g);assert.equal(cells.length,g.barCount);for(const row of g.rows){assert.equal(row.length,75);for(const c of row)assert.ok(c.charCodeAt(0)>=48&&c.charCodeAt(0)<=123);}for(const c of cells){assert.ok(c.h>0&&c.h<=450);assert.equal(c.h%6,0);assert.ok(c.d>=0&&c.d<75);assert.ok(c.r>=0&&c.r<g.count);}assert.equal(new Set(cells.map(c=>c.r+':'+c.d)).size,g.barCount);}
});
test('rotation changes model geometry while canonical view retains the original projection',()=>{
 const base=figmaProjection([0,0,0]),raised=figmaProjection([0,0,450]);assert.equal(raised[0],base[0]);assert.equal(Math.round(base[1]-raised[1]),450);
 const day=figmaProjection([19.8,0,0]);assert.ok(Math.abs(day[0]-base[0]-19.8)<1e-8);assert.ok(Math.abs(day[1]-base[1]-4.4)<1e-8);
 const row=figmaProjection([0,2.42,0]);assert.ok(Math.abs(row[0]-base[0]+2.42)<1e-8);assert.ok(Math.abs(row[1]-base[1]-1.595)<.001);
 assert.notDeepEqual(figmaProjection([100,50,100],.5,.2),figmaProjection([100,50,100]));
});
test('new chapters route without changing existing identity selection',()=>{for(const page of ['background','participation']){const r=readRoute('#'+page+'?person=1122',new Set([1122]));assert.equal(r.page,page);assert.equal(r.person,1122);}});
