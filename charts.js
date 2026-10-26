import {finite,fmt,escapeHTML as esc,segments,mean,correlation} from './data-utils.js';
export const tile=(p,cls='')=>`<svg class="${cls}" viewBox="0 0 1 1" aria-hidden="true"><use href="assets/tiles.svg#tile-${p.id}" width="1" height="1"/></svg>`;
const point=(a,r)=>[210+Math.sin(a)*r,210-Math.cos(a)*r];
const pt=(a,r)=>point(a,r).map(v=>v.toFixed(2)).join(',');
export function radial(person,data,{native=true,selectedMetric=null}={}){
 const label=`编号${person.displayId}的八项日记，${person.days}个记录日，孤独感单题均值${fmt(person.stats[0].mean)}`;
 if(native&&person.featured)return `<svg class="radial-svg" viewBox="0 0 436 436" role="img" aria-label="${label}"><use href="assets/radials.svg#radial-${person.id}" width="436" height="436"/></svg>`;
 let out=`<svg class="radial-svg" viewBox="0 0 420 420" role="img" aria-label="${label}"><title>${label}</title>`;
 for(const value of [0,2.5,5,7.5,10])out+=`<circle cx="210" cy="210" r="${38+value*12.6}" fill="none" stroke="#dce1d8" stroke-width=".65"/>`;
 data.metrics.forEach((m,i)=>{
  const a=i*Math.PI/4,dim=selectedMetric!==null&&selectedMetric!==i;
  out+=`<g class="radial-sector" data-radial-metric="${i}" opacity="${dim?.16:1}"><title>${esc(m.name)}：均值 ${fmt(person.stats[i].mean)}，有效 ${person.stats[i].n} 天</title>`;
  person.daily.forEach((row,j)=>{if(!finite(row[i]))return;const angle=a-.33+(j+.5)/75*.66;out+=`<line x1="${point(angle,38)[0].toFixed(2)}" y1="${point(angle,38)[1].toFixed(2)}" x2="${point(angle,38+row[i]*12.6)[0].toFixed(2)}" y2="${point(angle,38+row[i]*12.6)[1].toFixed(2)}" stroke="${m.color}" stroke-opacity=".46" stroke-width=".85"/>`;});
  const s=person.stats[i];
  if(finite(s.mean)){
   const p=point(a,38+s.mean*12.6),sd=s.sd||0,lo=point(a,38+Math.max(0,s.mean-sd)*12.6),hi=point(a,38+Math.min(10,s.mean+sd)*12.6);
   out+=`<path d="M${lo.join(',')}L${hi.join(',')}" stroke="${m.color}" stroke-width="1.5"/><circle cx="${p[0]}" cy="${p[1]}" r="3.7" fill="${m.color}"/>`;
  }
  const ref=data.referenceMeans[i];if(finite(ref)){const p=point(a+.15,38+ref*12.6);out+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.8" stroke="${m.color}" fill="#fcfbf7" stroke-width="1.2"/>`;}
  const p=point(a,190);out+=`<text x="${p[0]}" y="${p[1]+4}" text-anchor="middle" fill="${m.color}" font-size="12" font-family="Arial">0${i+1}</text></g>`;
 });
 out+=`<circle cx="210" cy="210" r="37" fill="#fcfbf7"/><text x="210" y="211" text-anchor="middle" fill="#253234" font-family="Georgia,serif" font-size="28">${person.displayId}</text><text x="210" y="231" text-anchor="middle" fill="#677571" font-size="11">${person.days}天</text><text x="224" y="163" fill="#677571" font-size="8">0</text><text x="247" y="108" fill="#677571" font-size="8">5</text><text x="272" y="51" fill="#677571" font-size="8">10</text><svg x="348" y="354" width="55" height="43" viewBox="0 0 1 1" preserveAspectRatio="none"><use href="assets/tiles.svg#tile-${person.id}" width="1" height="1"/></svg></svg>`;
 return out;
}
export function avatar(person,cls=''){
 // Deterministic illustration, not an inference about the participant's appearance.
 const colors=['#345c83','#678b74','#a97658','#776b91','#b39a4a'];const shirt=colors[person.id%5];const hair=['#3b3532','#594a3d','#7a6850'][person.id%3];let r='';
 const rect=(x,y,w,h,c)=>{r+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;};
 rect(5,1,6,2,hair);rect(4,3,8,6,hair);rect(5,4,6,6,'#e3c6a4');rect(5,4,6,1,hair);rect(4,4,1,4,hair);if(person.id%2)rect(11,5,1,6,hair);rect(6,6,1,1,'#31333a');rect(9,6,1,1,'#31333a');rect(7,9,2,2,'#d3b58e');rect(4,11,8,7,shirt);rect(3,12,1,6,shirt);rect(12,12,1,6,shirt);rect(3,18,1,2,'#e3c6a4');rect(12,18,1,2,'#e3c6a4');rect(5,18,6,2,'#3b4250');rect(5,20,2,7,'#49505b');rect(9,20,2,7,'#49505b');rect(4,27,3,1,'#29313d');rect(9,27,3,1,'#29313d');
 return `<svg class="${cls}" viewBox="0 0 16 30" role="img" aria-label="按编号生成的像素小人示意，非真实肖像" shape-rendering="crispEdges">${r}</svg>`;
}
export const personColors=['#398194','#b05d67','#8a8e45','#756796'];
export function timeline(people,metric,{centered=false,start=1,end=75}={}){
 const W=1000,H=290,L=46,R=24,T=26,B=38;const x=day=>L+(day-start)/Math.max(1,end-start)*(W-L-R),y=v=>T+((centered?10:10)-v)/(centered?20:10)*(H-T-B);
 let s=`<svg class="timeline-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${people.length}人逐日评分，D${start}至D${end}，${centered?'减去全期个人均值，共用负10至正10':'共用0至10分'}刻度；缺失日断开连线"><title>逐日轨迹。缺失日不连线，点击日值可查看日期与数值。</title>`;
 for(const v of centered?[-10,-5,0,5,10]:[0,2,4,6,8,10])s+=`<path d="M${L},${y(v)}H${W-R}" stroke="${v===0?'#acb6ab':'#e3e6dd'}" stroke-width="${v===0?1:.6}"/><text x="${L-13}" y="${y(v)+3}" fill="#66716f" font-size="10" text-anchor="end">${v>0&&centered?'+':''}${v}</text>`;
 const days=[start, ...[15,30,45,60].filter(d=>d>start&&d<end),...(end!==start?[end]:[])];
 for(const d of days)s+=`<text x="${x(d)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#66716f">D${String(d).padStart(2,'0')}</text>`;
 people.forEach((p,i)=>{
  const ref=centered?p.stats[metric].mean:0,values=p.daily.slice(start-1,end).map(r=>finite(r[metric])&&finite(ref)?r[metric]-ref:null);
  for(const line of segments(values))s+=`<path d="${line.map(([j,v],k)=>(k?'L':'M')+x(j+start).toFixed(2)+','+y(v).toFixed(2)).join('')}" fill="none" stroke="${personColors[i]}" stroke-width="1.6" ${i===1?'stroke-dasharray="6 3"':''}/>`;
  values.forEach((v,j)=>{if(!finite(v))return;s+=`<circle cx="${x(j+start)}" cy="${y(v)}" r="3.4" fill="${personColors[i]}" fill-opacity=".12" stroke="${personColors[i]}" stroke-width=".5" data-tip="${p.displayId} · D${j+start} · ${p.dates[j+start-1]||'日期未报告'} · ${centered?'相对均值 ':''}${fmt(v)}分" tabindex="0" role="img" aria-label="编号${p.displayId}，D${j+start}，${fmt(v)}分"><title>${p.displayId} · D${j+start} · ${fmt(v)}</title></circle>`;});
 });return s+'</svg>';
}
export function scatter(p,start=1,end=75){
 const mx=p.stats[6].mean,my=p.stats[0].mean,pairs=p.daily.slice(start-1,end).filter(r=>finite(r[0])&&finite(r[6]));
 const x=v=>35+(v+10)/20*235,y=v=>258-(v+10)/20*225;
 let s=`<svg class="scatter-svg" viewBox="0 0 300 300" role="img" aria-label="编号${p.displayId}回应感与孤独感的个人均值偏离值，${pairs.length}个配对日，相关${fmt(correlation(pairs.map(r=>[r[6],r[0]])))}，不代表因果"><text x="18" y="21" fill="#1c294b" font-size="12">${p.displayId} / n=${pairs.length}</text>`;
 for(const v of[-10,0,10])s+=`<path d="M${x(v)},33V258M35,${y(v)}H270" stroke="#d8dcd2" stroke-width="${v===0?1:.5}"/><text x="${x(v)}" y="277" fill="#66716f" font-size="8" text-anchor="middle">${v}</text><text x="26" y="${y(v)+3}" fill="#66716f" font-size="8" text-anchor="end">${v}</text>`;
 if(finite(mx)&&finite(my))for(const r of pairs)s+=`<circle cx="${x(r[6]-mx)}" cy="${y(r[0]-my)}" r="2.5" fill="#398194" fill-opacity=".3"><title>回应偏离 ${fmt(r[6]-mx)}，孤独偏离 ${fmt(r[0]-my)}</title></circle>`;
 return s+'<text x="152" y="294" text-anchor="middle" font-size="8" fill="#66716f">回应感 − 全期个人均值</text></svg>';
}
