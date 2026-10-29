import {finite} from './data-utils.js';

// Exploratory thresholds, not a diagnosis or an inferred dropout mechanism.
export const coverageThresholds=[7,15,30];
export const coverageThreshold=value=>coverageThresholds.includes(Number(value))?Number(value):15;
export const observedDays=p=>p.heat.filter(finite).length;
export function coverageGroups(people,threshold=15){
 const limit=coverageThreshold(threshold);
 const low=people.filter(p=>observedDays(p)<=limit).sort((a,b)=>observedDays(a)-observedDays(b)||a.id-b.id);
 const rest=people.filter(p=>observedDays(p)>limit);
 return {limit,low,rest};
}
export function coverageBins(people){
 return [[0,0],[1,7],[8,15],[16,30],[31,45],[46,60],[61,75]].map(([min,max])=>({min,max,label:min===max?String(min):`${min}–${max}`,count:people.filter(p=>{const n=observedDays(p);return n>=min&&n<=max;}).length}));
}
export const coverageFields=[
 {key:'gender',name:'性别',labels:['女性','男性','跨性别／非二元／其他性别','未报告']},
 {key:'age',name:'年龄',labels:['18–29 岁','30–44 岁','45–59 岁','60 岁及以上','未报告']},
 {key:'income',name:'年收入 · 美元',labels:['低于 $9,999','$10,000 - $19,999','$20,000 - $39,999','$40,000 – $59,999','$60,000 – $79,000','$80,000 – $99,999','超过 $100,000','未报告']},
 {key:'living',name:'居住状况',labels:['独居','与家人／伴侣同住','与朋友／室友同住','未报告']},
 {key:'relationship',name:'婚恋状态',labels:['单身','有伴侣','已婚','未报告']},
 {key:'parent',name:'子女情况',labels:['无子女','有子女且同住','有子女但不同住','未报告']}
];
export function coverageCategory(p,key){
 const value=p.profile[key];
 if(key==='age')return !finite(value)?'未报告':value<30?'18–29 岁':value<45?'30–44 岁':value<60?'45–59 岁':'60 岁及以上';
 return value||'未报告';
}
export function coverageComparison(low,rest,field){
 // Preserve any source label not in the preferred order rather than discarding it.
 const labels=[...new Set([...field.labels,...[...low,...rest].map(p=>coverageCategory(p,field.key))])];
 return labels.map(label=>{
  const n=low.filter(p=>coverageCategory(p,field.key)===label).length;
  const other=rest.filter(p=>coverageCategory(p,field.key)===label).length;
  const share=low.length?n/low.length:null,reference=rest.length?other/rest.length:null;
  return {label,n,other,share,reference,delta:share===null||reference===null?null:(share-reference)*100};
 });
}

// Person-level descriptive summaries; absent scores never become zero.
const coverageMedian=values=>{
 const sorted=values.filter(finite).sort((a,b)=>a-b),n=sorted.length;
 return n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null;
};
export function coverageEvidence(people,threshold=15){
 const {limit,low,rest}=coverageGroups(people,threshold);
 const gray=group=>group.reduce((sum,p)=>sum+75-observedDays(p),0);
 const describe=group=>{
  const ages=group.map(p=>p.profile.age).filter(finite);
  const lowerIncome=group.filter(p=>['低于 $9,999','$10,000 - $19,999','$20,000 - $39,999'].includes(p.profile.income)).length;
  return {n:group.length,ageMedian:coverageMedian(ages),ageKnown:ages.length,lowerIncome,lowerIncomeShare:group.length?lowerIncome/group.length:null};
 };
 const missing=gray(low),totalMissing=gray(people);
 const noDiary=low.reduce((sum,p)=>sum+75-p.days,0);
 return {limit,low:describe(low),rest:describe(rest),missing,totalMissing,noDiary,incomplete:missing-noDiary,missingShare:totalMissing?missing/totalMissing:null};
}

// Film coverage matrix: one actual person per column, original D01–D75 vertically.
export function coverageMatrixData(people,threshold=15){
 const {limit,low}=coverageGroups(people,threshold),evidence=coverageEvidence(people,limit);
 const columns=people.map(p=>({id:p.id,displayId:p.displayId,days:observedDays(p),valid:p.heat.map(finite)})).sort((a,b)=>a.days-b.days||a.id-b.id);
 return {limit,columns,lowCount:low.length,missing:evidence.missing,totalMissing:evidence.totalMissing,missingShare:evidence.missingShare};
}
