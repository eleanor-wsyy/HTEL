// Prepare the reviewable film plan from the webpage's authoritative data.
// This step deliberately does not render or encode a movie.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sgSchema, sgColors, buildSankeyModel} from '../../sankey-data.js';
import {coverageEvidence, coverageGroups, coverageFields, coverageComparison} from '../../coverage.js';
import {figmaModels} from '../../figma-model-data.js';
import {scoreLayers} from '../../data-utils.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git('rev-parse','origin/main');
const paths=['index.html','data/study.json','data-utils.js','sankey-data.js','figma-model-data.js','figma-gallery.js','coverage.js','coverage-view.js','research-boards.js','app.js'];
const inputs={};
for(const path of paths){
 const upstream=execFileSync('git',['show',commit+':'+path],{cwd:root,maxBuffer:32*1024*1024});
 const working=await readFile(new URL('../../'+path,import.meta.url));
 const canonical=bytes=>Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
 // index is read directly from the new commit when an older generated HTML is skipped.
 if(path!=='index.html')assert.deepEqual(canonical(working),canonical(upstream),'Checkout differs from latest source: '+path);
 inputs[path]={gitBlob:git('rev-parse',commit+':'+path),sha256:createHash('sha256').update(canonical(upstream)).digest('hex')};
}
const data=JSON.parse(await readFile(new URL('../../data/study.json',import.meta.url),'utf8'));
const people=data.people,model=buildSankeyModel(people);
assert.equal(model.aligned,true);assert.equal(model.total,515);assert.equal(model.nodes.length,31);assert.equal(model.flows.length,283);
const nodes=model.nodes.map(n=>({id:n.key+'|'+n.value,stage:n.stage,variable:n.key,label:n.value,n:n.n,personIds:n.ids}));
const paths6=model.flows.map(f=>({index:f.index,labels:f.labels,personIds:f.ids,n:f.ids.length,color:f.color}));
const edges=[];
for(let stage=0;stage<sgSchema.length-1;stage++){
 const map=new Map();
 for(const flow of paths6){
  const source=sgSchema[stage].key+'|'+flow.labels[stage],target=sgSchema[stage+1].key+'|'+flow.labels[stage+1];
  // Retain residence color even when aggregating adjacent node pairs.
  const key=JSON.stringify([source,target,flow.color]);
  if(!map.has(key))map.set(key,{stage,source,target,color:flow.color,n:0,personIds:[]});
  const edge=map.get(key);edge.n+=flow.n;edge.personIds.push(...flow.personIds);
 }
 edges.push(...map.values());
}
for(let stage=0;stage<6;stage++){
 assert.equal(nodes.filter(n=>n.stage===stage).reduce((s,n)=>s+n.n,0),515);
 for(const node of nodes.filter(n=>n.stage===stage)){
  assert.equal(paths6.filter(f=>f.labels[stage]===node.label).reduce((s,f)=>s+f.n,0),node.n);
  if(stage<5)assert.equal(edges.filter(e=>e.source===node.id).reduce((s,e)=>s+e.n,0),node.n);
  if(stage>0)assert.equal(edges.filter(e=>e.target===node.id).reduce((s,e)=>s+e.n,0),node.n);
 }
}
assert.equal(paths6.reduce((s,f)=>s+f.n,0),515);
assert.equal(new Set(paths6.flatMap(f=>f.personIds)).size,515);
assert.deepEqual(edges.reduce((a,e)=>(a[e.stage]+=e.n,a),Array(5).fill(0)),Array(5).fill(515));
const adjacencyCounts=Array.from({length:5},(_,i)=>new Set(paths6.map(f=>JSON.stringify([f.labels[i],f.labels[i+1]]))).size);
assert.deepEqual(adjacencyCounts,[17,19,14,28,25]);

const major=(id,start,end,page,title,summary)=>({id,start,end,kind:'chapter-transition',page,title,summary});
const section=(id,start,end,page,title,summary,extra={})=>({id,start,end,kind:'data',page,title,summary,...extra});
const segments=[
 {id:'intro',start:0,end:14,kind:'intro',page:'home',title:'515个人，75天。',summary:'我们的社交互动，如何影响孤独？'},
 major('chapter-background',14,19,'background','故事开始，我们先来认识写下这些日常的人','从六个背景维度，认识同一批515人。'),
 section('sankey',19,44,'background','515 人的基线资料流向','六个变量，31个节点；流带宽度表示人数。',{transition:false}),
 major('chapter-overview',44,49,'overview','孤独有形，日常有迹。','从一天的记录，展开515个人的日常。'),
 section('mosaic',49,64,'overview','关于每一个方块的构成','大格代表人，小格代表日；颜色来自两题平均。',{transition:false}),
 section('models',64,88,'overview','相同的 75 天窗口，不同的填写轨迹。','连续与间断，让记录长出不同的形状。'),
 section('variation',88,102,'overview','孤独水平与日常波动，有怎样的关系？','把平均水平与日常起伏放在一起看。'),
 major('chapter-archives',102,107,'archives','走进个人档案馆','当每一个人的日常都围绕着八种感受展开'),
 section('radial',107,129,'archives','走进个人档案馆','从评分尺、日线到均值与波动，逐层生成圆图。',{transition:false}),
 major('chapter-compare',129,134,'compare','相似的感受，不同的日常。','同样的均值，会有怎样不同的日常？'),
 section('compare-overview',134,140,'compare','同一把尺，八种感受。','八项感受在同一评分尺上并置。',{transition:false}),
 section('compare-daily',140,153,'compare','把每一天，放回时间里。','同分，不同起伏。'),
 section('compare-score',153,163,'compare','同样的孤独评分，对应怎样的互动？','同分，互动也不同。'),
 major('chapter-participation',163,168,'participation','谁的日常，留在记录里？','从参与比例，走向连续性，再回看均值。'),
 section('daily-participation',168,174,'participation','75 天里，每天有多少人填写日记？','沿日次看参与比例的变化。',{transition:false}),
 section('longest-streak',174,179,'participation','最长连续填写天数','记录也有长短。'),
 section('weekly-trend',179,184,'participation','记录人数变化时，平均分怎样变化？','均分与人数一起看。'),
 section('attrition',184,192,'participation','均值变化时，回答的人也在变化。','看均分，也看谁在写。'),
 section('first-week',192,199,'participation','填写时长分组与首周孤独均值','回看最初的感受。'),
 major('chapter-outsiders',199,210,'outsiders','当记录的天数减少，','那些未被看见的日常里，作为拥有灰色格子最多的那群人，有哪些感受同样值得我们关注？'),
 section('coverage',210,218,'outsiders','为什么默认选 ≤ 15 天？','75天中有效双题记录不超过15天，意味着至少80%的灰格。',{transition:false}),
 section('coverage-profiles',218,228,'outsiders','他们会有什么与众不同的特点吗？','两组，都按组内占比看。'),
 section('coverage-gallery',228,232,'outsiders','灰格之后，仍然是具体的人。','从一格，回到一个人。'),
 {id:'close',start:232,end:238,kind:'close',page:'home',title:'看见孤独',summary:'总览孤独感受之后，看见独立个体。'}
];
const latestHtml=execFileSync('git',['show',commit+':index.html'],{cwd:root,encoding:'utf8'});
const compareTitle=latestHtml.match(/id="compare-title">([\s\S]*?)<\/h2>/)?.[1]?.replace(/<[^>]*>/g,'');
assert.ok(compareTitle,'Missing webpage compare heading');
segments.find(s=>s.id==='chapter-compare').title=compareTitle;
for(let i=0;i<segments.length;i++){
 assert.equal(segments[i].start,i?segments[i-1].end:0);
 assert.ok(segments[i].end>segments[i].start);
 segments[i].startFrame=segments[i].start*30;segments[i].endFrame=segments[i].end*30;
 if(segments[i].kind==='data'&&segments[i].transition!==false)segments[i].transition={duration:segments[i].end-segments[i].start<10?2:3,effect:'typewriter',title:segments[i].title,summary:segments[i].summary};
}
const {low,rest}=coverageGroups(people,15),evidence=coverageEvidence(people,15);
const profiles=coverageFields.map(field=>({key:field.key,name:field.name,rows:coverageComparison(low,rest,field)}));
const participants=[478,498].map(id=>{const p=people.find(p=>Number(p.displayId)===id);return {id:p.id,displayId:p.displayId,profile:p.profile,days:p.days,compositeMean:p.mean,stats:p.stats,scoreLayers:scoreLayers(p)};});
const models=figmaModels.map(m=>({title:m.title,name:m.name,count:m.count,barCount:m.barCount}));
const output=new URL('./data/',import.meta.url);await mkdir(output,{recursive:true});
const save=(name,value)=>writeFile(new URL(name,output),JSON.stringify(value,null,2)+'\n','utf8');
await save('film4-sankey.json',{sourceCommit:commit,variables:sgSchema,residenceColors:sgColors,nodes,paths:paths6,adjacentColoredFlows:edges,adjacencyCounts});
const plan={status:'script-for-review',sourceCommit:commit,width:1920,height:1080,fps:30,duration:238,totalFrames:7140,audio:{narrationText:'docs/video/storyboard-v4.md',mode:'narration-ready',voice:null,music:null},visual:{paper:'#f7f6ef',ink:'#1c294b',missing:'#e4e7ec',metrics:data.metrics,showWebUI:false},transition:{effect:'typewriter',titleFirst:true,summarySecond:true,holdAfterTyping:1.5},segments,inputs};
await save('film4-plan.json',plan);
const audit={sourceCommit:commit,status:'data-and-plan-verified; movie-not-rendered',sankey:{variables:6,nodes:nodes.length,completePaths:paths6.length,participants:515,adjacencyCounts,allNodesBalanced:true,allPathsRetained:true},recordCounts:data.meta,models,participants,coverage:{evidence,profiles,sensitivity:[7,15,30].map(t=>coverageEvidence(people,t))},duration:238,frames:7140};
await writeFile(new URL('../../docs/video/film4-data-audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceCommit:commit,segments:segments.length,duration:238,frames:7140,sankey:{variables:6,nodes:31,paths:283,adjacencyCounts,balanced:true},compareTitle,coverage:evidence,files:['docs/video/film4-data-audit.json','scripts/video/data/film4-plan.json','scripts/video/data/film4-sankey.json']},null,2));
