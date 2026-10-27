import {finite} from './data-utils.js';
export const sgSchema=[
 {key:'relationship',name:'婚恋状态',values:['单身','有伴侣','已婚','未报告'],expected:[152,142,219,2]},
 {key:'age',name:'年龄段',values:['18–24 岁','25–34 岁','35–44 岁','45–54 岁','55–64 岁','65 岁及以上','未报告'],expected:[69,170,101,80,48,45,2]},
 {key:'gender',name:'性别',values:['女性','男性','跨性别／非二元／其他性别','未报告'],expected:[360,116,36,3]},
 {key:'living',name:'居住状况',values:['独居','与朋友／室友同住','与家人／伴侣同住','未报告'],expected:[104,65,333,13]},
 {key:'income',name:'年收入（美元）',values:['低于 $9,999','$10,000 - $19,999','$20,000 - $39,999','$40,000 – $59,999','$60,000 – $79,000','$80,000 – $99,999','超过 $100,000','未报告'],expected:[62,37,69,61,91,51,136,8]},
 {key:'parent',name:'子女情况',values:['无子女','有子女但不同住','有子女且同住','未报告'],expected:[309,68,136,2]}
];
export const sgColors={'独居':'#DD6248','与朋友／室友同住':'#D59B32','与家人／伴侣同住':'#0C8F7B','未报告':'#969B91'};
export const sgLabel=value=>({'跨性别／非二元／其他性别':'跨性别／非二元／其他','与朋友／室友同住':'与朋友或室友同住','与家人／伴侣同住':'与家人或伴侣同住','有子女但不同住':'有子女不同住','有子女且同住':'有子女同住'}[value]||value);
export function sgValue(person,key){if(key!=='age')return person.profile[key]||'未报告';const age=person.profile.age;return !finite(age)?'未报告':age<25?'18–24 岁':age<35?'25–34 岁':age<45?'35–44 岁':age<55?'45–54 岁':age<65?'55–64 岁':'65 岁及以上';}
export function sgClean(filters){return Object.fromEntries(sgSchema.filter(f=>Object.hasOwn(filters,f.key)&&f.values.includes(filters[f.key])).map(f=>[f.key,filters[f.key]]));}
export function sgFilter(people,filters){const clean=sgClean(filters);return people.filter(p=>Object.entries(clean).every(([key,value])=>sgValue(p,key)===value));}
export function buildSankeyModel(people){
 const groups=new Map();for(const p of people){const labels=sgSchema.map(f=>sgValue(p,f.key)),key=JSON.stringify(labels);if(!groups.has(key))groups.set(key,{labels,ids:[]});groups.get(key).ids.push(p.id);}
 const flows=[...groups.values()].sort((a,b)=>{for(let i=0;i<6;i++){const delta=sgSchema[i].values.indexOf(a.labels[i])-sgSchema[i].values.indexOf(b.labels[i]);if(delta)return delta;}return 0;});
 const unit=(.63-.07)/515;let aligned=people.length===515;const nodes=[];
 sgSchema.forEach((field,i)=>{const counts=new Map(field.values.map(value=>[value,[]]));for(const p of people){const value=sgValue(p,field.key);if(!counts.has(value))counts.set(value,[]);counts.get(value).push(p.id);}let cursor=.8;const gap=.07/(counts.size-1);for(const [value,ids]of counts){const node={key:field.key,field:field.name,stage:i,value,ids,n:ids.length,x:.035+i*.182,top:cursor,bottom:cursor-ids.length*unit,used:0};nodes.push(node);cursor=node.bottom-gap;}if(field.values.some((value,j)=>counts.get(value)?.length!==field.expected[j])||counts.size!==field.values.length)aligned=false;});
 const lookup=new Map(nodes.map(n=>[n.key+'|'+n.value,n]));flows.forEach((flow,index)=>{flow.index=index;flow.height=flow.ids.length*unit;flow.ys=flow.labels.map((label,i)=>{const node=lookup.get(sgSchema[i].key+'|'+label),y=node.top-node.used*unit;node.used+=flow.ids.length;return y;});flow.color=sgColors[flow.labels[3]]||sgColors['未报告'];});
 return {nodes,flows,aligned,total:people.length};
}
export function sgRibbonPath(flow){const X=i=>(.035+i*.182)*3840,Y=y=>(1-y)*2160,w=.0058*3840,h=flow.height*2160;let d='M'+(X(0)+w)+' '+Y(flow.ys[0]);for(let i=1;i<6;i++){const a=X(i-1)+w,b=X(i),bend=(b-a)*.43;d+='C'+(a+bend)+' '+Y(flow.ys[i-1])+' '+(b-bend)+' '+Y(flow.ys[i])+' '+b+' '+Y(flow.ys[i]);if(i<5)d+='L'+(b+w)+' '+Y(flow.ys[i]);}d+='L'+X(5)+' '+(Y(flow.ys[5])+h);for(let i=4;i>=0;i--){const a=X(i)+w,b=X(i+1),bend=(b-a)*.43;d+='C'+(b-bend)+' '+(Y(flow.ys[i+1])+h)+' '+(a+bend)+' '+(Y(flow.ys[i])+h)+' '+a+' '+(Y(flow.ys[i])+h);if(i>0)d+='L'+X(i)+' '+(Y(flow.ys[i])+h);}return d+'Z';}
export function sgNodeBoxes(node){const x=node.x*3840,w=.0058*3840,top=(1-node.top)*2160,h=(node.top-node.bottom)*2160;if(node.value==='未报告'){const labelW=350;return {bar:{x,y:top,width:w,height:Math.max(5,h)},label:{x:node.stage===5?x+w-labelW:x-12,y:(1-.133)*2160-18,width:labelW,height:62}};}const labelW=Math.max(250,Math.min(500,sgLabel(node.value).length*30));const anchor=node.stage===5?x-.004*3840:x+w+.004*3840;return {bar:{x:x-6,y:top,width:w+12,height:Math.max(6,h)},label:{x:node.stage===5?anchor-labelW:anchor-7,y:top+h/2-58,width:labelW+14,height:105}};}
