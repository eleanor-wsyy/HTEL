import {finite} from './data-utils.js';

const living=['独居','与家人／伴侣同住','与朋友／室友同住'];
const incomes=['超过 $100,000','$80,000 – $99,999','$60,000 – $79,000','$40,000 – $59,999','$20,000 - $39,999','$10,000 - $19,999','低于 $9,999'];
const rank=(value,values)=>{const i=values.indexOf(value);return i<0?values.length:i;};
const numberCompare=(a,b,ascending=false)=>!finite(a)?(!finite(b)?0:1):!finite(b)?-1:ascending?a-b:b-a;
const singleRank=p=>rank(p.profile.relationship,['单身','有伴侣','已婚']);
const parentRank=p=>p.profile.parent?.startsWith('有子女')?0:p.profile.parent==='无子女'?1:2;

export const sortOptions=[
 ['high','孤独均值：高 → 低'],['low','孤独均值：低 → 高'],['id','编号：小 → 大'],
 ['age','年龄：高 → 低'],['age-living','年龄优先 → 居住状况'],['income','年收入区间：高 → 低'],
 ['living-id','居住状况分组 → 编号'],['single','婚恋分组 → 孤独均值'],['parent','父母身份分组 → 孤独均值']
];
export function sortPeople(people,mode='high',metric='composite'){
 const score=p=>metric==='single'?p.stats[0].mean:p.mean;
 return [...people].sort((a,b)=>{
  let result=0;
  switch(mode){
   case 'high': case 'low': result=numberCompare(score(a),score(b),mode==='low');break;
   case 'age': result=numberCompare(a.profile.age,b.profile.age);break;
   case 'age-living': result=numberCompare(a.profile.age,b.profile.age)||rank(a.profile.living,living)-rank(b.profile.living,living);break;
   case 'income': result=rank(a.profile.income,incomes)-rank(b.profile.income,incomes);break;
   case 'living-id': result=rank(a.profile.living,living)-rank(b.profile.living,living);break;
   case 'single': result=singleRank(a)-singleRank(b)||numberCompare(score(a),score(b));break;
   case 'parent': result=parentRank(a)-parentRank(b)||numberCompare(score(a),score(b));break;
  }
  return result||a.id-b.id;
 });
}
export function sortDescription(mode,metric='composite'){
 const score=metric==='single'?'全期孤独感单题均值':'D01—D75 有效日双题孤独均值';
 const descriptions={
  high:`按${score}从高到低排列，便于观察整体水平的差异。`,
  low:`按${score}从低到高排列。`,id:'按展示编号从小到大排列。',
  age:'先按年龄从高到低排列；同龄按编号从小到大。',
  'age-living':'先按年龄从高到低；同龄按独居、与家人／伴侣同住、与朋友／室友同住排列，再按编号。',
  income:'按年收入区间从高到低排列；同一区间按编号。来源为美元年收入区间，不代表精确工资。',
  'living-id':'按独居、与家人／伴侣同住、与朋友／室友同住分组；组内编号从小到大。',
  single:`按单身、有伴侣、已婚分组；组内按${score}从高到低。`,
  parent:`按有子女、无子女分组；有子女包括同住与不同住，组内按${score}从高到低。`
 };
 return (descriptions[mode]||descriptions.id)+' 缺失值在对应排序层级末尾；并列时按编号。';
}
export function sortContext(p,mode){
 if(mode==='age'||mode==='age-living')return `${finite(p.profile.age)?p.profile.age+' 岁':'年龄未报告'}${mode==='age-living'?' · '+p.profile.living:''}`;
 if(mode==='income')return '年收入 '+p.profile.income;
 if(mode==='living-id')return p.profile.living;
 if(mode==='single')return p.profile.relationship;
 if(mode==='parent')return p.profile.parent;
 return `编号 ${p.displayId}`;
}
