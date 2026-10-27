import {figmaModels} from './figma-model-data.js';
export const figmaCharts = [
 ['baseline-sankey','283:26780','515 人的基线资料流向',3840,2160],
 ['age-living','283:24197','不同居住方式的年龄分布',3840,1230],
 ['age-gender','283:15681','不同性别的年龄分布',1140,1024],
 ['age-other','283:18537','不同族群的年龄分布',1140,1024],
 ['age-third','283:21450','有无子女的年龄分布',1140,1024],
 ['mean-variation','293:3527','孤独均值与标准差',1552,1246],
 ['six-splits','273:1089','六次二分：从身份分类中寻找孤独均值差异',1440,1024],
 ['ten-splits','273:1779','十次二分：从身份分类中寻找孤独均值差异',1440,1024],
 ['daily-participation','281:168477','75 天里，每天有多少人填写日记？',2198,1461],
 ['longest-streak','293:2','最长连续填写天数',2198,1205],
 ['pattern-1','276:56116','几乎每天填写 · 192 人',2600,1755],
 ['pattern-2','276:111327','时间较短但基本连续 · 14 人',2600,1755],
 ['pattern-3','276:114744','断断续续填写 · 242 人',2600,1755],
 ['pattern-4','276:165426','5 月前停止填写 · 38 人',2600,1755],
 ['pattern-5','276:168076','填写少于 7 晚 · 29 人',2600,1755],
 ['attrition-mean','269:549','样本流失与孤独均值',1440,1024],
 ['first-week','270:1032','填写时长分组与首周孤独均值',1440,1024]
];
let figmaAssetCache;
function figmaAsset(key){if(figmaAssetCache===undefined){const embedded=document.getElementById('figma-assets-data');figmaAssetCache=embedded?JSON.parse(embedded.textContent):null;}return figmaAssetCache?.[key]||'assets/figma/'+key+'-paper.png';}
export function figmaFigure(key){
 const c=figmaCharts.find(c=>c[0]===key);if(!c)return '';
 return `<figure class="figma-figure" data-figma="${key}"><div class="figma-art"><img src="${figmaAsset(key)}" width="${key==='age-living'?1140:c[3]}" height="${key==='age-living'?1024:c[4]}" loading="lazy" alt="${c[2]}，完整图表"></div><figcaption><strong>${c[2]}</strong><div class="figma-actions"><button type="button" data-art-open="${key}">放大查看 ↗</button></div></figcaption></figure>`;
}
export function mountFigmaGallery(){
 const fill=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html;};
 fill('figma-background',figmaFigure('baseline-sankey')+'<section class="demographics-section" aria-labelledby="age-distributions-title"><div class="figma-section-intro"><p class="eyebrow">AGE DISTRIBUTIONS</p><h2 id="age-distributions-title">不同背景中的年龄分布</h2></div><div class="figma-demographics">'+['age-living','age-gender','age-other','age-third'].map(key=>figmaFigure(key)).join('')+'</div></section>');
 fill('figma-trees','<div class="section-heading"><div><p class="eyebrow">BACKGROUND & LONELINESS</p><h2>不同背景组合下，孤独感有什么差异？</h2></div></div>'+figmaFigure('ten-splits'));
 fill('figma-retention-top',figmaFigure('daily-participation')+figmaFigure('longest-streak'));
 fill('figma-patterns',figmaModels.map((m,i)=>`<section class="figma-pattern" data-model-group="${i}">${figmaFigure('pattern-'+(i+1))}<div class="figma-model-tools"><button data-model-open="${i}" type="button">放大并旋转模型 ↗</button><span>拖动查看不同角度，柱高、位置和颜色保持一致。</span></div></section>`).join(''));
 fill('figma-retention-end',figmaFigure('attrition-mean')+figmaFigure('first-week'));
 document.addEventListener('click',e=>{const a=e.target.closest('[data-chapter]');if(a){e.preventDefault();document.getElementById(a.dataset.chapter)?.scrollIntoView({block:'start'});}});
 const dialog=document.createElement('dialog');dialog.id='figma-viewer';dialog.className='figma-viewer';dialog.innerHTML='<div class="figma-viewer-bar"><h2></h2><div><button data-view-action="out" aria-label="缩小">−</button><output>100%</output><button data-view-action="in" aria-label="放大">＋</button><button data-view-action="reset">复位</button><button data-view-action="close" aria-label="关闭图表查看器">关闭 ×</button></div></div><p class="figma-viewer-help"></p><div class="figma-viewer-stage" tabindex="0"></div>';document.body.append(dialog);
 let scale=1,model=null,trigger=null,cleanup=null;
 const stage=dialog.querySelector('.figma-viewer-stage');
 function update(){dialog.querySelector('output').value=Math.round(scale*100)+'%';if(model){model.setZoom(scale);}else{const img=stage.querySelector('img');if(img)img.style.width=Math.round(stage.clientWidth*scale)+'px';}}
 function close(){dialog.close();cleanup?.();cleanup=null;model=null;stage.replaceChildren();trigger?.focus({preventScroll:true});}
 document.addEventListener('click',e=>{const t=e.target.closest('[data-art-open],[data-model-open]');if(!t)return;trigger=t;const isModel=t.hasAttribute('data-model-open'),key=isModel?'pattern-'+(+t.dataset.modelOpen+1):t.dataset.artOpen,c=figmaCharts.find(c=>c[0]===key);scale=1;dialog.querySelector('h2').textContent=c[2];dialog.querySelector('.figma-viewer-help').textContent=isModel?'拖动旋转，滚轮或 ＋ / − 放大缩小；方向键旋转，Home 复位。原稿中的空缺柱保持空缺。':'Ctrl + 滚轮或 ＋ / − 放大缩小，放大后滚动查看全部细节。';stage.innerHTML=isModel?'<canvas tabindex="0" aria-label="可旋转的原稿柱体模型"></canvas>':`<img src="${figmaAsset(key)}" alt="${c[2]}，完整图表">`;dialog.showModal();if(isModel){model=createFigmaModel(stage.querySelector('canvas'),figmaModels[+t.dataset.modelOpen],z=>{scale=z;dialog.querySelector('output').value=Math.round(z*100)+'%';});cleanup=()=>model?.dispose();}update();stage.querySelector('canvas')?.focus();});
 dialog.addEventListener('click',e=>{const action=e.target.closest('[data-view-action]')?.dataset.viewAction;if(action==='close')close();else if(action){scale=action==='reset'?1:Math.max(.5,Math.min(5,scale+(action==='in'?.25:-.25)));if(action==='reset')model?.reset();update();}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 stage.addEventListener('wheel',e=>{if(model||!e.ctrlKey)return;e.preventDefault();scale=Math.max(.5,Math.min(5,scale+(e.deltaY<0?.1:-.1)));update();},{passive:false});
}

// The canonical projection is measured from the original column faces, not study-data regeneration.
export function figmaColumnCells(group){const cells=[];group.rows.forEach((row,r)=>[...row].forEach((code,d)=>{const units=code.charCodeAt(0)-48;if(units>0)cells.push({r,d,h:units*6});}));return cells;}
export function figmaProjection(point,yaw=0,pitch=0,cy=230){
 const [x,y,z]=point,cx=742.5;
 const a=x-cx,b=y-cy,rx=a*Math.cos(yaw)-b*Math.sin(yaw),ry=a*Math.sin(yaw)+b*Math.cos(yaw),rz=z-225;
 const ty=ry*Math.cos(pitch)-rz*Math.sin(pitch),tz=ry*Math.sin(pitch)+rz*Math.cos(pitch)+225;
 return [850.29+cx+rx-cy-ty,665.75+(cx+rx)*2/9+(cy+ty)*(.30624/.46464)-tz];
}
function createFigmaModel(canvas,group,onZoom){
 const ctx=canvas.getContext('2d'),cells=figmaColumnCells(group),colors=group.colors.map(c=>'rgb('+[c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',')+')');let yaw=0,pitch=0,zoom=1,drag=null,raf=0,disposed=false;
 function draw(){raf=0;if(disposed)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,rect.width,rect.height);
  const factor=Math.min(rect.width/2600,rect.height/1500)*zoom;ctx.save();ctx.translate(rect.width/2,rect.height/2);ctx.scale(factor,factor);ctx.translate(-1300,-740);
  const p=(x,y,z)=>figmaProjection([x,y,z],yaw,pitch,(group.count-1)*1.21),line=(a,b)=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
  ctx.strokeStyle='#d9dedf';ctx.lineWidth=1.2;for(const day of [0,7,14,30,45,60,74])line(p(day*19.8,0,0),p(day*19.8,group.count*2.42,0));for(let r=0;r<=group.count;r+=Math.max(1,Math.ceil(group.count/8)))line(p(0,r*2.42,0),p(1485,r*2.42,0));
  const faces=[];const add=(v,color)=>{const screen=v.map(a=>p(...a)),depth=v.reduce((n,a)=>n+(a[0]-742.5)*Math.sin(yaw)+(a[1]-230)*Math.cos(yaw),0)/v.length;faces.push({screen,color,depth});};
  for(const b of cells){const x=b.d*19.8,y=b.r*2.42,h=b.h,w=15.05,t=1.75;add([[x,y,0],[x+w,y,0],[x+w,y,h],[x,y,h]],colors[1]);add([[x+w,y,0],[x+w,y+t,0],[x+w,y+t,h],[x+w,y,h]],colors[0]);add([[x,y+t,0],[x+w,y+t,0],[x+w,y+t,h],[x,y+t,h]],colors[1]);add([[x,y,0],[x,y+t,0],[x,y+t,h],[x,y,h]],colors[0]);add([[x,y,h],[x+w,y,h],[x+w,y+t,h],[x,y+t,h]],colors[2]);}
  faces.sort((a,b)=>a.depth-b.depth);for(const f of faces){ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(...f.screen[0]);f.screen.slice(1).forEach(v=>ctx.lineTo(...v));ctx.closePath();ctx.fill();}
  ctx.fillStyle='#1c294b';ctx.font='22px sans-serif';ctx.strokeStyle='#1c294b';ctx.lineWidth=1.5;const label=(text,v)=>ctx.fillText(text,...v),front=group.count*2.42;line(p(0,front,0),p(1485,front,0));label('X · 第1—75天',p(650,front+65,0));for(const d of [1,8,15,31,46,61,75])label(String(d),p((d-1)*19.8,front+25,0));line(p(-90,0,0),p(-90,(group.count-1)*2.42,0));label('Y · 填写的用户',p(-240,group.count*1.21,0));for(const r of [...new Set([1,...[50,100,150,200].filter(n=>n<group.count),group.count])])label(String(r),p(-130,(r-1)*2.42,0));line(p(1530,0,0),p(1530,0,450));label('Z · 用户填写量',p(1530,0,485));for(let z=0;z<=450;z+=90)label(Math.round(z/450*100)+'%',p(1540,0,z));ctx.restore();
 }
 function schedule(){if(!raf&&!disposed)raf=requestAnimationFrame(draw);}
 const setZoom=value=>{zoom=Math.max(.5,Math.min(5,value));onZoom(zoom);schedule();};
 const down=e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};
 const move=e=>{if(!drag||drag.id!==e.pointerId)return;yaw+=(e.clientX-drag.x)*.006;pitch=Math.max(-1.1,Math.min(1.1,pitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;schedule();};
 const up=()=>{drag=null;};const wheel=e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));};
 const reset=()=>{yaw=0;pitch=0;setZoom(1);};
 const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-','='].includes(e.key))e.preventDefault();else return;if(e.key==='Home')reset();else if(['+','=','-'].includes(e.key))setZoom(zoom+(e.key==='-'?-.25:.25));else{yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pitch=Math.max(-1.1,Math.min(1.1,pitch+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0)));schedule();}};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);const observer=new ResizeObserver(schedule);observer.observe(canvas);schedule();
 return {setZoom,reset,dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('lostpointercapture',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);}};
}
