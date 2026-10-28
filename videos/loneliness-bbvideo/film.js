/* BB-Video / Swiss + truthful data drawings. Every frame depends only on t. */
(() => {
'use strict';
const D=window.ATLAS_DATA, P=D.people, M=D.metrics, MOD=D.models;
const C={paper:'#f7f6ef',ink:'#1c294b',muted:'#66716f',line:'#d8dcd2',blue:'#285de8',teal:'#398194',rose:'#b05d67',grey:'#e4e7ec'};
const clamp=x=>Math.max(0,Math.min(1,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x)}, U=(t,a,b)=>smooth((t-a)/(b-a)), L=(t,a,b)=>clamp((t-a)/(b-a));
const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)), mix=(a,b,q)=>'#'+rgb(a).map((v,i)=>Math.round(v*(1-q)+rgb(b)[i]*q).toString(16).padStart(2,'0')).join('');
const idx=new Map(P.map((p,i)=>[Number(p.displayId),i])), person=id=>P[idx.get(id)], means=P.map(p=>p.mean), ranks=Array(515), order=P.map((p,i)=>i).sort((a,b)=>means[b]-means[a]||a-b);
order.forEach((i,j)=>ranks[i]=j);
const valid=P.map(p=>p.heat.map(x=>typeof x==='number'&&Number.isFinite(x))), days=valid.map(r=>r.filter(Boolean).length), coverageOrder=P.map((p,i)=>i).sort((a,b)=>days[a]-days[b]||a-b), coverRank=[];coverageOrder.forEach((i,j)=>coverRank[i]=j);
const low=days.filter(n=>n<=15).length;let lowMissing=0,missing=0;days.forEach(n=>{missing+=75-n;if(n<=15)lowMissing+=75-n});
if(P.length!==515||missing!==10840||low!==49)throw Error('Canonical data mismatch');
const swatch=v=>{
 if(v===null||!Number.isFinite(v))return C.grey;
 const s=[[0,'#fff5ba'],[1.6,'#ffe066'],[3.2,'#f7bb38'],[4.1,'#72c7cf'],[5.3,'#1686bd'],[6.7,'#174c94'],[10,'#10233f']];let i=0;while(i<5&&v>s[i+1][0])i++;return mix(s[i][1],s[i+1][1],clamp((v-s[i][0])/(s[i+1][0]-s[i][0])));
};
const metricColor=(v,base)=>v===null?C.grey:mix('#fcfbf7',base,.18+.82*v/10);
function canvas(w=1920,h=1080){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const tileImages=P.map(p=>{const c=canvas(150,50),x=c.getContext('2d');p.heat.forEach((v,d)=>{x.fillStyle=swatch(v);x.fillRect((d%15)*10,Math.floor(d/15)*10,10,10)});return c});
const tp=i=>[116+(i%26)*65,310+Math.floor(i/26)*27];
let ctx,boxes=[],allCopy=new Set();
function T(x,y,text,size=34,color=C.ink,align='left',alpha=1,weight=400){
 if(alpha<.002)return;ctx.save();ctx.globalAlpha*=alpha;ctx.font=`${weight} ${size}px AtlasSans`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign=align;ctx.fillText(String(text),x,y);
 const w=ctx.measureText(String(text)).width,xx=x-(align==='right'?w:align==='center'?w/2:0);boxes.push({x:xx,y,w,h:size*1.22,text:String(text)});allCopy.add(String(text));ctx.restore();
}
function line(points,color=C.line,width=2,alpha=1){if(points.length<2||alpha<.002)return;ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore()}
function rect(x,y,w,h,color,alpha=1){if(w<=0||h<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore()}
function dot(x,y,r,color,stroke=null,width=2){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(color){ctx.fillStyle=color;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function img(im,x,y,w,h){ctx.imageSmoothingEnabled=false;ctx.drawImage(im,x,y,w,h)}
function axis(x,y,w,h,ymax=10){line([[x,y],[x,y+h],[x+w,y+h]],C.muted,1.8);for(const v of [0,ymax/2,ymax]){const yy=y+h*(1-v/ymax);line([[x,yy],[x+w,yy]],C.line,1);T(x-20,yy-14,String(v),25,C.muted,'right')}for(const [d,s]of[[0,'D01'],[24,'D25'],[49,'D50'],[74,'D75']])T(x+d/74*w,y+h+18,s,27,C.muted,'center')}
function footer(s){T(116,987,s,22,C.muted)}
function atlas(t,sort=0,exclude=-1,alpha=1){ctx.save();ctx.globalAlpha=alpha;for(let i=0;i<515;i++){if(i===exclude)continue;const a=tp(i),b=tp(ranks[i]),q=U(t,.3+(i%31)*.018,2+(i%31)*.018);if(!q)continue;img(tileImages[i],a[0]*(1-sort)+b[0]*sort,a[1]*(1-sort)+b[1]*sort-(1-q)*110,60,20)}ctx.restore()}
function legend(x=1320,y=881,w=445){for(let i=0;i<225;i++)rect(x+i*w/225,y,w/225+1,18,swatch(i/224*10));T(x,y+28,'0',25,C.muted);T(x+w,y+28,'10',25,C.muted,'right')}
let modelOverviewCache=null;
const NAMES=['几乎每天填写','时间较短但基本连续','断断续续填写','5月前停止填写','填写少于7晚'];
const MODELCELLS=MOD.map(m=>{const out=[];m.rows.forEach((row,r)=>[...row].forEach((c,d)=>{const h=c.charCodeAt(0)-48;if(h>0)out.push([r,d,h])}));if(out.length!==m.barCount)throw Error('Original model bar mismatch');return out});
const rotate=(x,y,z,yaw,pitch,cy)=>{const a=x-742.5,b=y-cy,rx=a*Math.cos(yaw)-b*Math.sin(yaw),ry=a*Math.sin(yaw)+b*Math.cos(yaw),rz=z-225,s=Math.SQRT1_2,c=Math.cos(pitch),sn=Math.sin(pitch),dot=(rx-ry)*s;return [rx*c-rz*s*sn+s*dot*(1-c),ry*c-rz*s*sn-s*dot*(1-c),rz*c+(rx+ry)*s*sn]};
const project=p=>[p[0]-p[1],p[0]*2/9+p[1]*(.30624/.46464)-p[2]], depth=p=>p[0]+p[1]+(2/9+.30624/.46464)*p[2];
function drawModel(g,box,yaw=0,pitch=0,extrusion=1,reveal=75,axes=true){
 const cy=(MOD[g].count-1)*1.21,ext=[];for(const x of[0,1500])for(const y of[0,584])for(const z of[0,450])ext.push(project(rotate(x,y,z,yaw,pitch,cy)));
 const lx=Math.min(...ext.map(p=>p[0])),hx=Math.max(...ext.map(p=>p[0])),ly=Math.min(...ext.map(p=>p[1])),hy=Math.max(...ext.map(p=>p[1]));const [bx,by,bw,bh]=box,s=Math.min(bw/(hx-lx),bh/(hy-ly)),ox=bx+bw/2-(lx+hx)/2*s,oy=by+bh/2-(ly+hy)/2*s;
 const mesh=[],o=rotate(0,0,0,yaw,pitch,cy),nx=rotate(1,0,0,yaw,pitch,cy).map((v,i)=>v-o[i]),ny=rotate(0,1,0,yaw,pitch,cy).map((v,i)=>v-o[i]);
 const faces=[depth(nx)>0?[1,2,6,5]:[0,3,7,4],depth(ny)>0?[2,3,7,6]:[0,1,5,4],[4,5,6,7]],col=['#7897c6','#76a9a9','#6eae9c','#ca9c59','#bf7c87'][g],cols=[mix(col,C.ink,.19),mix(col,C.ink,.08),mix(col,C.paper,.16)];
 for(const[r,d,h]of MODELCELLS[g]){if(d>=reveal)continue;const x=d*19.8,y=r*2.42,z=h*6*extrusion,raw=[[x,y,0],[x+15.05,y,0],[x+15.05,y+1.75,0],[x,y+1.75,0],[x,y,z],[x+15.05,y,z],[x+15.05,y+1.75,z],[x,y+1.75,z]],v=raw.map(p=>rotate(...p,yaw,pitch,cy));faces.forEach((face,j)=>mesh.push({p:face.map(k=>{const q=project(v[k]);return [q[0]*s+ox,q[1]*s+oy]}),z:face.reduce((sum,k)=>sum+depth(v[k]),0)/4,c:cols[j]}))}
 mesh.sort((a,b)=>a.z-b.z);for(const f of mesh){ctx.fillStyle=f.c;ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}
 if(axes){const q=[[0,0,0],[1485,0,0],[0,(MOD[g].count-1)*2.42,0],[0,0,450]].map(p=>{const v=project(rotate(...p,yaw,pitch,cy));return [v[0]*s+ox,v[1]*s+oy]});for(let i=1;i<4;i++)line([q[0],q[i]],C.ink,1.2);T(q[0][0]-10,q[0][1]+14,'D01',23,C.muted,'right');T(q[1][0],q[1][1]+14,'D75',23,C.muted,'center')}
}

// Baseline joint groups; no inferred ribbons from marginal counts.
const keys=['gender','living','parent'],cats=[['女性','男性','跨性别／非二元／其他性别','未报告'],['独居','与朋友／室友同住','与家人／伴侣同住','未报告'],['无子女','有子女但不同住','有子女且同住','未报告']],short={'跨性别／非二元／其他性别':'其他性别','与朋友／室友同住':'朋友／室友','与家人／伴侣同住':'家人／伴侣','有子女但不同住':'有子女不同住','有子女且同住':'有子女同住'},flowColors=['#DD6248','#D59B32','#0C8F7B','#969B91'];
const groups=new Map();for(const p of P){const labels=keys.map(k=>p.profile[k]||'未报告'),k=JSON.stringify(labels);if(!groups.has(k))groups.set(k,{labels,n:0});groups.get(k).n++}const flows=[...groups.values()].sort((a,b)=>{for(let j=0;j<3;j++){const q=cats[j].indexOf(a.labels[j])-cats[j].indexOf(b.labels[j]);if(q)return q}return 0});
const nodes=[],nl=new Map(),unit=447/515;for(let j=0;j<3;j++){let y=338;for(const val of cats[j]){const n=P.filter(p=>(p.profile[keys[j]]||'未报告')===val).length,node={j,val,n,x:335+j*650,y,h:n*unit,used:0};nodes.push(node);nl.set(`${j}|${val}`,node);y+=node.h+23}}
for(const f of flows){f.y=f.labels.map((val,j)=>{const n=nl.get(`${j}|${val}`),y=n.y+n.used*unit;n.used+=f.n;return y});f.color=flowColors[cats[1].indexOf(f.labels[1])]}
const sankey=canvas(),sctx=sankey.getContext('2d');for(const f of flows)for(let j=0;j<2;j++){const x=357+j*650,xx=335+(j+1)*650,y=f.y[j],yy=f.y[j+1],h=f.n*unit,dx=(xx-x)*.43;sctx.fillStyle=f.color+'70';sctx.beginPath();sctx.moveTo(x,y);sctx.bezierCurveTo(x+dx,y,xx-dx,yy,xx,yy);sctx.lineTo(xx,yy+h);sctx.bezierCurveTo(xx-dx,yy+h,x+dx,y+h,x,y+h);sctx.closePath();sctx.fill()}

const scenes=[
 {a:0,b:14,id:'scope',title:'515个人，75天。',sub:'先看整个样本，再逐步走近一个人的日常。',role:'hook'},
 {a:14,b:31,id:'background',title:'这515个人，生活在怎样的背景里？',sub:'同一批人，按性别、居住和子女情况分组。'},
 {a:31,b:53,id:'atlas',title:'把全体日常，放进同一幅图。',sub:'一大格是一人；内部75个小格，依次记录D01—D75。'},
 {a:53,b:81,id:'models',title:'记录的连续与断裂，也有形状。',sub:'从515人的全体，进入五组原稿填写轨迹；高度不是孤独分数。'},
 {a:81,b:100,id:'missing',title:'有些人，只被看见了很少几天。',sub:'回到真实人物ID：按有效双题日数排序，寻找记录覆盖的空白。'},
 {a:100,b:114,id:'person',title:'再走近其中一个人。',sub:'从515人的总览中，定位编号478的75个日次。'},
 {a:114,b:143,id:'radial',title:'把一个人的八种感受，展开。',sub:'此处从总览双题复合分，切换为八项单题。'},
 {a:143,b:169,id:'compare',title:'再选一个人，看看相同均值的背后。',sub:'编号478和498，孤独感单题均值同为3.44。'},
 {a:169,b:180,id:'ending',title:'看见一个人，也看见未被记录的日常。',sub:'回到515个人：一个平均数，无法概括全部生活。',role:'resolve',end:true},
];
function body(id,t){
 if(id==='scope'){
   T(118,316,'515',258,C.ink,'left',U(t,.3,1.6),700);T(655,482,'个人',62,C.ink,'left',U(t,1,2));T(916,420,'×',125,C.muted,'center',U(t,1.6,2.6));T(1100,316,'75',258,C.blue,'left',U(t,2.2,3.5),700);T(1515,482,'日次',62,C.ink,'left',U(t,2.8,4));
   const n=Math.floor(L(t,3,8.7)*515);for(let i=0;i<n;i++){const x=124+(i%103)*16.3,y=740+Math.floor(i/103)*25;dot(x,y,3.4,C.teal)}
   T(116,905,'38,625 个可能的人日格',47,C.ink,'left',U(t,8.8,10));T(1800,916,'一枚点＝一位参与者',27,C.muted,'right',U(t,5.5,7));footer('D01是每个人各自入组后的第一天，并非所有人的同一个日历日。');
 } else if(id==='background'){
   const xx=335+1300*U(t,1.2,10);ctx.save();ctx.beginPath();ctx.rect(0,0,xx,1080);ctx.clip();ctx.drawImage(sankey,0,0);ctx.restore();
   ['性别','居住状况','子女情况'].forEach((s,j)=>T(335+j*650,290,s,32,C.ink,'left',U(t,j*2,j*2+.8),700));
   for(const n of nodes){const a=U(t,n.j*2,n.j*2+.8);rect(n.x,n.y,22,n.h,n.j===1?flowColors[cats[1].indexOf(n.val)]:C.ink,a);if(n.val!=='未报告')T(n.x-18,n.y+n.h/2-15,`${short[n.val]||n.val} ${n.n}`,27,C.ink,'right',a)}
   [3,13,2].forEach((n,j)=>T(335+j*650,885,`未报告 ${n} 人`,24,C.muted));T(116,932,'这些背景组合，描述的是同一批515人。',37,C.ink,'left',U(t,11,12.2));footer('流带宽度＝实际人数；类别交叉不表示人生状态随时间改变。');
 } else if(id==='atlas'){
   atlas(t,U(t,10,15));T(116,895,'双题复合分＝（孤独感＋被排斥感）÷2',37,C.ink,'left',U(t,3.8,5));legend();T(116,943,t<12?'先完整看见515人的75天，再按个人均值重排。':'位置改变，属于每个人的75天没有改变。',28,C.muted,'left',U(t,7,8));footer('仅当两题同时有效才计算；黄—蓝表示评分高低，灰色表示不可计算，灰色不等于0分。');
 } else if(id==='models'){
   if(t<12){const p=-1.0135*U(t,8.6,9.7)*(1-U(t,10.2,11.5));drawModel(0,[155,325,1450,535],.1*Math.sin(Math.PI*L(t,6,12)),p,U(t,3.8,7.8),Math.max(1,L(t,.4,3.7)*75));T(1320,293,'192 人',57,C.ink,'left',U(t,.5,1.5));T(1320,370,NAMES[0],32,C.muted);T(116,928,t<4?'先展开时间与人物行，再长出连续段的高度。':t<8.6?'真实连续段，长出各自的高度。':'俯视看缺口，斜视看连续段高低。',37,C.ink)}
   else if(t<20){const g=Math.min(4,1+Math.floor((t-12)/2)),q=(t-12)%2;drawModel(g,[155,325,1450,535],.08*Math.sin(q),0,.7+.3*U(q,0,.8));T(1280,293,`${MOD[g].count} 人`,57,C.ink);T(1280,370,NAMES[g],32,C.muted);T(116,928,'同样75个日次，留下不同的连续与断裂。',37,C.ink)}
   else{if(!modelOverviewCache){const old=ctx;modelOverviewCache=canvas();ctx=modelOverviewCache.getContext('2d');for(let g=0;g<5;g++)drawModel(g,[110+g*350,355,330,410],0,0,1,75,false);ctx=old;}ctx.drawImage(modelOverviewCache,0,0);for(let g=0;g<5;g++){T(110+g*350,808,`${MOD[g].count} 人`,43,['#7897c6','#76a9a9','#6eae9c','#ca9c59','#bf7c87'][g]);T(110+g*350,870,NAMES[g],22,C.ink)}T(116,933,'515人共处一个观察窗口，却没有留下同样完整的记录。',35,C.ink,'left',U(t,23,24))}
   line([[1780,450],[1780,720]],C.muted,1.5);[0,25,50,75].forEach(v=>{const y=720-v/75*270;line([[1773,y],[1787,y]],C.muted,1.5);T(1758,y-14,String(v),24,C.muted,'right')});T(1795,430,'天',23,C.muted);footer('X：D01—D75；Y：原稿组内行序号；Z：连续段高度编码。28,019根原稿柱，行号未映射人物ID。');
 } else if(id==='missing'){
   const x=166,y=344,w=1080,h=480,grow=Math.max(1,Math.floor(L(t,.4,3)*75)),sort=U(t,3.3,6.5);rect(x,y,w,h,C.grey);
   for(let i=0;i<515;i++){const xx=x+(i*(1-sort)+coverRank[i]*sort)*w/515;for(let d=0;d<grow;d++)if(valid[i][d])rect(xx,y+d*h/75,w/515+.1,h/75+.1,C.teal)}
   [1,25,50,75].forEach(d=>T(x-18,y+(d-1)/74*h-13,`D${String(d).padStart(2,'0')}`,24,C.muted,'right'));T(x,y+h+24,'每列一人',26,C.muted);T(x+w,y+h+24,'515人',26,C.muted,'right');
   line([[x+w*49/515,y-12],[x+w*49/515,y+h+7]],C.rose,3,U(t,7,8));T(x,y-52,'≤15 有效双题日',29,C.rose,'left',U(t,7,8));
   T(1320,329,'49',143,C.rose,'left',U(t,7.2,8.6),700);T(1320,516,'人，占样本9.5%',36,C.muted,'left',U(t,8,9));T(1320,640,'对应全部不可计算格的',27,C.muted,'left',U(t,10.5,12));T(1320,693,'31.3%',76,C.teal,'left',U(t,11.5,13),700);rect(1320,808,420,22,C.grey);rect(1320,808,420*lowMissing/missing*U(t,11.5,13.5),22,C.teal);
   T(116,932,'记录少，不能告诉我们他们为何没有写。',37,C.ink,'left',U(t,14.2,15.5));footer('≤15天为本项目的探索性阈值；不可计算的格子不能用于推断退出原因或性格。');
 } else if(id==='person'){
   const i=idx.get(478),at=tp(ranks[i]),q=U(t,2.2,6.8);if(t<7)atlas(30,1,i,1-q);const x=at[0]*(1-q)+124*q,y=at[1]*(1-q)+440*q,w=60*(1-q)+1110*q,h=20*(1-q)+370*q;img(tileImages[i],x,y,w,h);
   if(t<2.5){ctx.strokeStyle=C.blue;ctx.lineWidth=3;ctx.strokeRect(at[0]-5,at[1]-5,70,30)}
   const p=person(478),a=U(t,5.8,7);T(1330,330,'478',112,C.ink,'left',a,700);T(1330,478,'编号',31,C.muted,'left',a);T(1330,552,`${p.profile.gender} · ${p.profile.age}岁`,36,C.muted,'left',a);T(1330,641,'75/75',72,C.teal,'left',a,700);T(1330,735,'双题有效日',31,C.muted,'left',a);T(1330,808,`双题均值 ${p.mean.toFixed(2)}`,34,C.ink,'left',a);
   T(116,930,'从人群中的一格，走近这个人的每一天。',38,C.ink,'left',U(t,8,9.2));footer('这75格仍是总览的双题复合分；下一段将切换为八个单题维度。');
 } else if(id==='radial'){
   const p=person(478),cx=625,cy=590,r0=46,R=278,step=Math.PI/4;for(const v of[0,2,4,6,8,10]){dot(cx,cy,r0+(R-r0)*v/10,null,C.line,1)}
   for(const v of[0,5,10])T(cx+12,cy-(r0+(R-r0)*v/10)-12,String(v),23,C.muted);
   const focus=U(t,24,27);for(let m=0;m<8;m++){const mid=-Math.PI/2+m*step,col=M[m].color,fade=m===0?1:1-.82*focus;T(cx+310*Math.cos(mid),cy+310*Math.sin(mid)-14,String(m+1).padStart(2,'0'),29,col,'center',fade*U(t,1.2+m*.2,2+m*.2));const grow=Math.floor(L(t,4+m*.18,12+m*.18)*75);
     for(let d=0;d<grow;d++){const v=p.daily[d][m];if(v===null)continue;const ang=mid-step*.43+step*.86*d/74,r=r0+(R-r0)*v/10;line([[cx+r0*Math.cos(ang),cy+r0*Math.sin(ang)],[cx+r*Math.cos(ang),cy+r*Math.sin(ang)]],col,1.3,.55*fade)}
     const st=p.stats[m],mu=st.mean,sd=st.sd,a=U(t,14,16)*fade,rm=r0+(R-r0)*mu/10,lo=r0+(R-r0)*Math.max(0,mu-sd)/10,hi=r0+(R-r0)*Math.min(10,mu+sd)/10;
     line([[cx+lo*Math.cos(mid),cy+lo*Math.sin(mid)],[cx+hi*Math.cos(mid),cy+hi*Math.sin(mid)]],col,5,a);if(a>.01)dot(cx+rm*Math.cos(mid),cy+rm*Math.sin(mid),6,mix(C.paper,col,a));if(t>20){const r=r0+(R-r0)*D.referenceMeans[m]/10;dot(cx+r*Math.cos(mid),cy+r*Math.sin(mid),6,C.paper,mix(C.paper,col,U(t,20,22)*fade),2)}
   }
   dot(cx,cy,r0,C.paper);T(cx,cy-31,'478',41,C.ink,'center',1,700);T(cx,cy+19,'75日次',18,C.muted,'center');T(1190,299,'编号478',43,C.ink);T(1190,363,'3.44',95,C.teal,'left',U(t,23,25),700);T(1530,416,'孤独感单题均值',28,C.muted,'left',U(t,23,25));
   M.forEach((m,j)=>{const y=525+j*44;dot(1200,y+16,5,m.color);T(1225,y,`${String(j+1).padStart(2,'0')} ${m.name}`,29,m.color,'left',U(t,1.2+j*.2,2+j*.2));T(1760,y,p.stats[j].mean.toFixed(2),29,C.muted,'right',U(t,14,16))});T(116,932,'细线看每一天，实心点与线段看均值和波动。',37,C.ink,'left',U(t,14,16));footer('0分位于内圈，缺失不画线；线段为±1个样本标准差，空心点为精选27人等权均值。');
 } else if(id==='compare'){
   const ids=[478,498],cols=[C.blue,C.rose],box=[168,410,1580,350];
   if(t<5){ids.forEach((id,j)=>{T(150+j*900,299,`编号${id} · 均值3.44`,37,cols[j]);const p=person(id);for(let d=0;d<75;d++){const v=p.daily[d][0],x=150+j*900+(d%15)*42,y=430+Math.floor(d/15)*42;rect(x,y,39,39,metricColor(v,C.teal))}});T(116,876,'先用同一项、同一把尺，比较两个人。',39,C.ink,'left',U(t,1,2.2))}
   else{axis(...box);T(168,322,'孤独感单题 / 分',28,C.muted);ids.forEach((id,j)=>{const p=person(id);T(168+j*900,282,`编号${id} · 均值3.44`,37,cols[j]);const pts=p.daily.map((row,d)=>[168+d/74*1580,row[0]===null?NaN:760-row[0]/10*350]);if(t<8){const q=U(t,5,8);pts.forEach((p,d)=>dot((150+j*900+(d%15)*42+20)*(1-q)+p[0]*q,(430+Math.floor(d/15)*42+20)*(1-q)+p[1]*q,4,cols[j]))}else{const cut=L(t,8,15)*74;let group=[];pts.forEach((p,d)=>{if(d>cut)return;if(p.every(Number.isFinite))group.push(p);else{line(group,cols[j],3.5);group=[]}});line(group,cols[j],3.5);if(group.length)dot(...group[group.length-1],5,cols[j])}T(168+j*900,851,`SD ${p.stats[0].sd.toFixed(2)}`,57,cols[j],'left',U(t,17+j*.6,19+j*.6),700)});
     const yy=760-.344*350;for(let x=168;x<1748;x+=25)line([[x,yy],[x+12,yy]],C.ink,1.2,U(t,15,16.5));T(1748,yy-43,'共同均值3.44',27,C.ink,'right',U(t,15,16.5));T(1030,934,'均值相同，日常起伏并不相同。',37,C.ink,'left',U(t,20,22))}
   footer('曲线颜色区分人物；各自D01不是同一日历日。这里只描述两个人，不外推为总体规律。');
 } else if(id==='ending'){
   const q=U(t,.4,2.5),frac=27785/38625;T(116,322,'27,785',104,C.teal,'left',q,700);T(116,464,'有效双题格 · 71.9%',33,C.muted,'left',q);T(1800,322,'10,840',104,C.muted,'right',q,700);T(1800,464,'不可计算格 · 28.1%',33,C.muted,'right',q);rect(116,548,1688,67,C.grey);rect(116,548,1688*frac*q,67,C.teal);T(116,697,'515人 × 75日次 ＝ 38,625个可能格',46,C.ink,'left',U(t,3,4.3));T(116,813,'一个人，不止一个平均数。',55,C.ink,'left',U(t,4.8,6.1),700);footer('数据来源：Kuczynski等；项目提供的三份CSV。原始日记28,027行，按各自入组后最多75日次观察。');
 }
}
window.ATLAS_META={participants:515,windowDays:75,valid:27785,missing,low,models:MOD.map(m=>({n:m.count,bars:m.barCount})),scenes:scenes.map(({a,b,id})=>({a,b,id}))};
window.ATLAS_DATA_CHECK=()=>{if(MODELCELLS.reduce((s,a)=>s+a.length,0)!==28019)throw Error('bar count');for(const m of MOD)for(const row of m.rows){const a=[...row].map(c=>c.charCodeAt(0)-48);for(let i=0;i<75;){if(!a[i]){i++;continue}let j=i+1;while(j<75&&a[j])j++;for(let k=i;k<j;k++)if(a[k]!==j-i)throw Error('run height');i=j}}return {status:'passed',cells:515*75,bars:28019,low}}
PROMO.compose({bpm:120,offset:0,duration:180,cover:8,grain:false,theme:{bg:C.paper,fg:C.ink,ink:C.ink,paper:C.paper,accent:C.blue,muted:C.muted,fonts:{display:'AtlasSans, sans-serif',sans:'AtlasSans, sans-serif',serif:'AtlasSans, sans-serif',mono:'AtlasSans, sans-serif',script:'AtlasSans, sans-serif'}},build:async(F)=>{
 const X=PROMO.swiss(F,{accent:C.blue,colors:{ink:C.ink,paper:C.paper,grey:C.muted},font:'AtlasSans, sans-serif'});F.blurBase(1);F.stillMax(4);
 const checks=[];window.ATLAS_LAYOUT_AUDIT=()=>({boxes:checks.flat(),overflow:checks.flat().filter(b=>b.x<0||b.y<0||b.x+b.w>1920||b.y+b.h>1080)});
 for(let k=0;k<scenes.length;k++){
  const s=scenes[k],layer=X.scene(s.a,s.b,{ground:'paper',push:0,grid:false,variant:3});
  F.section(s.a,k===0?1:k===3?2:1,{name:s.id});F.scene(s.a,s.b,{role:s.role||'build',end:!!s.end});F.info(s.id==='background'?'flow':s.id==='compare'?'compare':'chart',s.a+.3,s.b,{group:s.id});F.cut(s.a);
  const cv=canvas();cv.style.cssText='position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:9;pointer-events:none';layer.appendChild(cv);const cx=cv.getContext('2d');
  X.meta(layer,{text:`${String(k+1).padStart(2,'0')} / THE SHAPE OF LONELINESS`,x:116,y:54,size:22,color:C.teal,at:s.a+.3,until:s.b,fact:false});
  X.type(layer,{text:s.title,x:112,top:116,size:65,weight:700,align:'left',at:s.a+1.15,until:s.b,by:'line',enter:'rise',exit:'none',maxW:1700,color:C.ink,sfx:false});
  X.line(layer,{text:s.sub,x:116,top:209,y:222,size:42,maxW:1700,align:'left',at:s.a+1.6,until:s.b,color:C.muted,sfx:false,exit:'none'});
  X.rule(layer,{x:116,y:270,w:1688,h:1.3,color:C.line,at:s.a+.7,until:s.b,exit:'none'});
  F.add(t=>{if(t<s.a||t>=s.b)return;ctx=cx;ctx.clearRect(0,0,1920,1080);boxes=[];body(s.id,t-s.a);line([[116,1040],[1804,1040]],C.line,1.2);line([[116,1040],[116+1688*t/180,1040]],C.teal,1.8);T(116,1051,'看见孤独 / 515个人的75天',17,C.muted);T(1804,1051,`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t)%60).padStart(2,'0')} / 03:00`,17,C.muted,'right');checks[k]=boxes.map(b=>({...b,scene:s.id}));});
  if(k>0)X.wipe({at:s.a,kind:k%3===0?'dot':k%2===0?'bands':'whip',onto:'paper',duration:.65});
 }
 // Canvas data components need explicit information metadata: they are not DOM words.
 const components=[['sample-size',.5,14],['day-window',2.3,14],['gender-column',14.5,31],['living-column',16.5,31],['children-column',18.5,31],['score-key',35.2,53],['whole-person-sort',41,53],['coverage-count',88.4,100],['coverage-missing-share',93,100],['person-valid-days',106.3,114],['pair-means',143.5,169],['pair-variation',160.4,169]];
 for(let g=0;g<5;g++)components.push(['original-3d-group-'+g,g===0?53.5:65+(g-1)*2,81]);
 for(let m=0;m<8;m++)components.push(['single-metric-'+m,115.5+m*.2,143]);
 for(const [name,a,b]of components)F.info('data-component',a,b,{group:name});
 F.prep(async()=>{await document.fonts.ready;window.ATLAS_DATA_CHECK();});
 // All canvas copy is registered for the factual check; exact provenance is in brief.md.
 // Fact windows follow the actual scene; unlike UI footage, custom charts are not exempted as live video.
 const appearanceTimes={scope:[.5,2.3,3.1,5.5,9.4,11],background:[.5,2.5,4.5,7,11.2,13],atlas:[.5,4.2,7.4,12,18],models:[.5,4,8.7,12.2,14.2,16.2,18.2,20.3,23.4],missing:[.5,7.4,8.4,10.8,12,14.6],person:[.5,6.3,8.5],radial:[.5,1.5,2.4,3.3,14.5,20.5,23.5,25],compare:[.5,1.4,5.2,8.2,15.4,17.4,18.1,20.4],ending:[.5,3.4,5.4]};
 for(const s of scenes){const tmp=canvas(),seen=new Set();ctx=tmp.getContext('2d');boxes=[];allCopy.clear();for(const t of appearanceTimes[s.id]){body(s.id,t);for(const text of allCopy)if(!seen.has(text)){F.fact(text,s.a+t,s.b);seen.add(text)}}allCopy.clear()}
 F.addLint(()=>{const report=window.ATLAS_LAYOUT_AUDIT();return report.overflow.map(b=>`Canvas bounds: ${b.scene}: ${b.text}`)});
}});
})();
