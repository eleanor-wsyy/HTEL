export const comparisonViews=['overview','daily','score'];
export function comparisonOptions(params){return {view:comparisonViews.includes(params.get('view'))?params.get('view'):'overview',focus:params.get('focus')==='all'?'all':'selected',layout:params.get('layout')==='paired'?'paired':'single'};}
export function fitMosaicWidth(width,height,mode='tiles'){return Math.max(1,mode==='matrix'?width:Math.min(width,height));}
export function longestRun(present){let best=0,run=0;for(const yes of present){run=yes?run+1:0;best=Math.max(best,run);}return best;}
export function cohortSummary(people){
 const complete=people.filter(p=>p.dates.filter(Boolean).length/75>=.9);
 const continuous=complete.filter(p=>{const present=p.dates.map(Boolean);return longestRun(present)===present.filter(Boolean).length;});
 return {all:people.length,complete:complete.length,continuous:continuous.length,ids:continuous.map(p=>p.id).sort((a,b)=>a-b),full:continuous.filter(p=>p.days===75).length,nearFull:continuous.filter(p=>p.days===74).length};
}
