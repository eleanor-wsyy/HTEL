import {finite,mean} from './data-utils.js';
import {boardRun} from './research-stats.js';
export function quantile(values,q=.5){const a=values.filter(finite).sort((a,b)=>a-b);if(!a.length)return null;const x=(a.length-1)*q,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i);}
export function recordMask(person,metric=-2){return metric===-2?person.dates.map(Boolean):metric===-1?person.heat.map(finite):person.daily.map(r=>finite(r[metric]));}
export function valueSeries(person,metric=0){return metric===-1?person.heat:person.daily.map(r=>r[metric]);}
export function cohortMetric(people,metric=0){const valid=people.filter(p=>finite(p.stats[metric]?.mean));return {n:people.length,validN:valid.length,mean:mean(valid.map(p=>p.stats[metric].mean)),days:valid.reduce((n,p)=>n+p.stats[metric].n,0)};}
export function makePosterTree(data,source){
 const byId=new Map(data.people.map(p=>[p.id,p]));const nodes=source.tree.nodes.map(n=>({...n,people:n.ids.map(id=>byId.get(id)).filter(Boolean)}));const map=new Map(nodes.map(n=>[n.id,n]));
 for(const n of nodes){if(n.people.length!==n.n)throw Error('分组成员与当前数据不一致');const avg=cohortMetric(n.people).mean;if(!finite(avg)||Math.abs(avg-n.mean)>1e-4)throw Error('分组均值与原图口径不一致');}
 const path=id=>{const out=[];let n=map.get(id);while(n){out.unshift(n);n=map.get(n.parent);}return out;};const leaves=nodes.filter(n=>!n.children.length);
 return {nodes,map,path,leaves,root:map.get(source.tree.root),excluded:source.excludedIds.map(id=>byId.get(id)).filter(Boolean)};
}
export function ageGroups(people,key,races=new Map()){
 const labels={living:['独居','与朋友／室友同住','与家人／伴侣同住','未报告'],gender:['女性','男性','跨性别／非二元／其他性别','未报告'],parent:['无子女','有子女但不同住','有子女且同住','未报告'],race:['白人／欧洲裔','混合族群','亚裔','黑人／非裔','西班牙裔／拉丁裔','未报告']};
 const groups=new Map((labels[key]||[]).map(label=>[label,[]]));for(const p of people){const label=(key==='race'?races.get(p.id):p.profile[key])||'未报告';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(p);}
 return [...groups].map(([label,people])=>{const reported=people.filter(p=>finite(p.profile.age));return {label,people,reported,n:people.length,ageN:reported.length,median:quantile(reported.map(p=>p.profile.age))};});
}
export function scatterPeople(people,metric=0,minimum=2){return people.filter(p=>p.stats[metric].n>=minimum&&finite(p.stats[metric].mean)&&finite(p.stats[metric].sd)).map(p=>({id:p.id,x:p.stats[metric].mean,y:p.stats[metric].sd,n:p.stats[metric].n,person:p}));}
export function dayRows(people,metric=0,record=-2){const masks=people.map(p=>recordMask(p,record)),values=people.map(p=>valueSeries(p,metric));return Array.from({length:75},(_,i)=>{const present=people.filter((p,j)=>masks[j][i]);const scored=people.filter((p,j)=>finite(values[j][i]));return {day:i+1,n:present.length,ids:present.map(p=>p.id),validN:scored.length,validIds:scored.map(p=>p.id),mean:mean(scored.map(p=>valueSeries(p,metric)[i]))};});}
export function streakRows(people,record=-2){const bins=Array.from({length:76},(_,days)=>({days,n:0,ids:[]}));for(const p of people){const n=boardRun(recordMask(p,record)).longest;bins[n].n++;bins[n].ids.push(p.id);}return bins;}
export function firstWeekGroups(people,metric=0,basis='last'){
 const bins=[[1,7],[8,14],[15,30],[31,45],[46,60],[61,75]];const out=bins.map(([a,b])=>({a,b,label:(basis==='last'?'D':'')+String(a).padStart(2,'0')+'—'+(basis==='last'?'D':'')+String(b).padStart(2,'0'),people:[],first:[]}));
 const none={a:0,b:0,label:'无记录',people:[],first:[]};for(const p of people){const mask=recordMask(p),run=boardRun(mask),value=basis==='last'?(run.last===null?0:run.last+1):run.n;const group=out.find(b=>value>=b.a&&value<=b.b)||none;group.people.push(p);const first=mean(valueSeries(p,metric).slice(0,7));if(finite(first))group.first.push(first);}
 if(none.people.length)out.unshift(none);return out.map(g=>({...g,n:g.people.length,validN:g.first.length,mean:mean(g.first),ids:g.people.map(p=>p.id)}));
}
export function csvText(columns,rows){const quote=value=>{let s=value===null||value===undefined?'':String(value);if(typeof value==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[columns,...rows].map(row=>row.map(quote).join(',')).join('\r\n');}

// Match the course timeline's mutually exclusive groups using submitted dates, not scores.
export function participationTimelineData(people){
 const groups=[{key:'regular',label:'几乎每天填写',rule:'75天内至少68个提交日',color:'#398475',light:'#b8ddd4'}, {key:'short',label:'较短，但基本连续',rule:'不足68天；首末记录之间缺口少于10%',color:'#6fb6a6',light:'#d1e9e2'}, {key:'intermittent',label:'断断续续填写',rule:'至少7个提交日，且存在较多间断',color:'#c79329',light:'#eee0ad'}, {key:'beforeMay',label:'5月前停止记录',rule:'至少7天；最后提交日期早于2020-05-01',color:'#d35c40',light:'#f0c2b4'}, {key:'few',label:'填写少于7天',rule:'0—6个提交日；仍保留在全体图中',color:'#823c34',light:'#d7aaa3'}].map(g=>({...g,rows:[]}));
 for(const person of people){const present=recordMask(person,-2),run=boardRun(present),first=present.indexOf(true),last=present.lastIndexOf(true),span=last<0?0:last-first+1,lastDate=last<0?null:person.dates[last],n=run.n,index=n>=68?0:n<7?4:lastDate<'2020-05-01'?3:n/span>.9?1:2;groups[index].rows.push({person,present,first,last,n,span,lastDate,longest:run.longest,start:run.start});}
 for(const g of groups)g.rows.sort((a,b)=>b.longest-a.longest||b.n-a.n||a.person.id-b.person.id);
 return groups;
}

// Deterministic local-linear tricube smoother. The band resamples people, not diary rows.
export function scatterSmooth(rows,{span=.4,steps=60,repeats=100,seed=731}={}){
 if(rows.length<4)return [];let randomState=seed>>>0;const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;},n=rows.length,k=Math.min(n,Math.max(4,Math.ceil(n*span))),low=Math.min(...rows.map(r=>r.x)),high=Math.max(...rows.map(r=>r.x));if(low===high)return [];
 const samples=Array.from({length:repeats},()=>{const w=new Uint16Array(n);for(let j=0;j<n;j++)w[Math.floor(random()*n)]++;return w;});
 return Array.from({length:steps},(_,i)=>{const x=low+(high-low)*i/(steps-1),distances=rows.map(r=>Math.abs(r.x-x)),bandwidth=[...distances].sort((a,b)=>a-b)[k-1]||1e-6,weights=distances.map(d=>Math.pow(1-Math.pow(Math.min(1,d/bandwidth),3),3)),predict=sample=>{let sw=0,sx=0,sy=0,sxx=0,sxy=0;rows.forEach((r,j)=>{const w=weights[j]*(sample?sample[j]:1),dx=r.x-x;sw+=w;sx+=w*dx;sy+=w*r.y;sxx+=w*dx*dx;sxy+=w*dx*r.y;});const determinant=sw*sxx-sx*sx;return sw?Math.max(0,Math.abs(determinant)>1e-12?(sy*sxx-sx*sxy)/determinant:sy/sw):null;},y=predict(),boot=samples.map(predict).filter(finite);return {x,y,lo:quantile(boot,.025),hi:quantile(boot,.975)};}).filter(r=>finite(r.y)&&finite(r.lo)&&finite(r.hi));
}
export function scatterHistogram(rows,axis,step,max){return Array.from({length:Math.ceil(max/step)},(_,i)=>{const min=i*step,upper=Math.min(max,(i+1)*step),points=rows.filter(r=>r[axis]>=min&&(r[axis]<upper||(i===Math.ceil(max/step)-1&&r[axis]<=upper)));return {index:i,min,max:upper,rows:points,n:points.length};});}
export function streakHue(days){const t=Math.max(0,Math.min(1,(days-1)/74)),a=t<.5?[176,93,103]:[234,213,120],b=t<.5?[234,213,120]:[57,132,117],u=t<.5?t*2:(t-.5)*2;return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*u).toString(16).padStart(2,'0')).join('');}
