export const finite = x => typeof x === 'number' && Number.isFinite(x);
export const mean = xs => {const a=xs.filter(finite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;};
export const fmt=(x,d=2)=>finite(x)?x.toFixed(d):'—';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const displayId=id=>String(Number(id)-1000);
const stops=[[0,'#fff5ba'],[1.6,'#ffe066'],[3.2,'#f7bb38'],[4.1,'#72c7cf'],[5.3,'#1686bd'],[6.7,'#174c94'],[10,'#10233f']];
export function color(value){if(!finite(value))return '#e4e7ec';const x=Math.min(10,Math.max(0,value));let i=0;while(i<stops.length-2&&x>stops[i+1][0])i++;const [a,c]=stops[i],[b,d]=stops[i+1],t=(x-a)/(b-a);return '#'+[1,3,5].map(j=>Math.round(parseInt(c.slice(j,j+2),16)*(1-t)+parseInt(d.slice(j,j+2),16)*t).toString(16).padStart(2,'0')).join('');}
// Same hue as the radial metric; only intensity changes with the 0–10 score.
export function metricColor(value,base){
 if(!finite(value))return '#e4e7ec';
 const amount=.18+.82*Math.min(10,Math.max(0,value))/10;
 const paper='#fcfbf7';
 return '#'+[1,3,5].map(i=>Math.round(parseInt(paper.slice(i,i+2),16)*(1-amount)+parseInt(base.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
}
export function correlation(pairs){const a=pairs.filter(([x,y])=>finite(x)&&finite(y));if(a.length<3)return null;const mx=mean(a.map(p=>p[0])),my=mean(a.map(p=>p[1]));let xy=0,xx=0,yy=0;for(const[x,y]of a){xy+=(x-mx)*(y-my);xx+=(x-mx)**2;yy+=(y-my)**2;}return xx&&yy?xy/Math.sqrt(xx*yy):null;}
export function segments(values){const out=[];let group=[];values.forEach((v,i)=>{if(finite(v))group.push([i,v]);else if(group.length){out.push(group);group=[];}});if(group.length)out.push(group);return out;}
export function parseSelection(value,valid){return [...new Set(String(value||'').split(',').map(Number).filter(id=>valid.has(id)))].slice(0,4);}
export function windowStats(person,metric,start=1,end=75){const values=person.daily.slice(start-1,end).map(row=>row[metric]);return {mean:mean(values),n:values.filter(finite).length,values};}
export function scoreLayers(person,start=1,end=75){return Array.from({length:11},(_,score)=>{const rows=person.daily.slice(start-1,end).filter(row=>row[0]===score);return {score,n:rows.length,interaction:mean(rows.map(r=>r[4])),responsiveness:mean(rows.map(r=>r[6]))};});}
export function readRoute(hash,valid){const[page,query='']=String(hash||'').replace(/^#/,'').split('?');const params=new URLSearchParams(query);const known=['home','overview','archives','compare','outsiders','method'];return {page:known.includes(page)?page:'home',person:valid.has(Number(params.get('person')))?Number(params.get('person')):null,flipped:params.get('flip')==='1',selection:params.has('ids')?parseSelection(params.get('ids'),valid):null,params};}
