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
 mountInlineFigmaModels();
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
export function figmaRotated(point,yaw=0,pitch=0,cy=230){
 const [x,y,z]=point,a=x-742.5,b=y-cy,rx=a*Math.cos(yaw)-b*Math.sin(yaw),ry=a*Math.sin(yaw)+b*Math.cos(yaw),rz=z-225,s=Math.SQRT1_2,c=Math.cos(pitch),sn=Math.sin(pitch),dot=(rx-ry)*s;
 return [rx*c-rz*s*sn+s*dot*(1-c),ry*c-rz*s*sn-s*dot*(1-c),rz*c+(rx+ry)*s*sn];
}
export function figmaProjection(point,yaw=0,pitch=0,cy=230){const [x,y,z]=figmaRotated(point,yaw,pitch,cy);return [850.29+742.5+x-cy-y,665.75+(742.5+x)*2/9+(cy+y)*(.30624/.46464)-(z+225)];}
export function figmaDepth(point,yaw=0,pitch=0,cy=230){const [x,y,z]=figmaRotated(point,yaw,pitch,cy);return x+y+(2/9+.30624/.46464)*z;}
export const figmaTopPitch=-Math.atan(Math.SQRT2/(2/9+.30624/.46464));

function createFigmaModel(canvas,group,onZoom=()=>{},options={}){
 const ctx=canvas.getContext('2d');if(!ctx){canvas.insertAdjacentHTML('afterend','<p>当前环境无法绘制，请切换原稿。</p>');return {setZoom(){},reset(){},setView(){},setActive(){},dispose(){}};}
 const cells=figmaColumnCells(group),colors=group.colors.map(c=>'rgb('+[c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',')+')');
 let yaw=0,pitch=0,zoom=1,panX=0,panY=0,raf=0,disposed=false,active=true,drag=null,pinch=null;const pointers=new Map(),cy=(group.count-1)*1.21;
 const clampPitch=x=>Math.max(-1.05,Math.min(.48,x));
 function draw(){raf=0;if(disposed||!active)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(2,devicePixelRatio||1),W=Math.round(rect.width*dpr),H=Math.round(rect.height*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,rect.width,rect.height);

  // A rigid rotation of the original coordinates. Basis projection avoids trigonometry per vertex.
  const o=figmaProjection([0,0,0],yaw,pitch,cy),unit=[[1,0,0],[0,1,0],[0,0,1]].map(v=>{const p=figmaProjection(v,yaw,pitch,cy);return [p[0]-o[0],p[1]-o[1]];}),originDepth=figmaDepth([0,0,0],yaw,pitch,cy),depth=[[1,0,0],[0,1,0],[0,0,1]].map(v=>figmaDepth(v,yaw,pitch,cy)-originDepth);
  const p=(x,y,z)=>[o[0]+x*unit[0][0]+y*unit[1][0]+z*unit[2][0],o[1]+x*unit[0][1]+y*unit[1][1]+z*unit[2][1]],line=(a,b)=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
  // Fit the complete geometry and axis anchors at 100%, including a physical text margin.
  const extents=[];for(const x of [0,1485])for(const y of [0,group.count*2.42])for(const z of [0,450])extents.push(p(x,y,z));for(const v of [[-350,group.count*1.21,0],[640,group.count*2.42+90,0],[1550,0,500],[1570,0,0]])extents.push(p(...v));
  const xs=extents.map(v=>v[0]),ys=extents.map(v=>v[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),factor=Math.min((rect.width-112)/(maxX-minX),(rect.height-70)/(maxY-minY))*zoom;
  ctx.save();ctx.translate((rect.width-52)/2+panX,rect.height/2+panY);ctx.scale(factor,factor);ctx.translate(-(minX+maxX)/2,-(minY+maxY)/2);
  ctx.strokeStyle='#d9dedf';ctx.lineWidth=.7/factor;for(const day of [0,7,14,30,45,60,74])line(p(day*19.8,0,0),p(day*19.8,group.count*2.42,0));for(let r=0;r<=group.count;r+=Math.max(1,Math.ceil(group.count/8)))line(p(0,r*2.42,0),p(1485,r*2.42,0));
  const ordered=[...cells].sort((a,b)=>(a.d*19.8-b.d*19.8)*depth[0]+(a.r*2.42-b.r*2.42)*depth[1]);
  const face=(vertices,color)=>{ctx.fillStyle=color;ctx.beginPath();vertices.forEach((v,i)=>{const point=p(...v);if(i)ctx.lineTo(...point);else ctx.moveTo(...point);});ctx.closePath();ctx.fill();};
  for(const b of ordered){const x=b.d*19.8,y=b.r*2.42,h=b.h,w=15.05,t=1.75;if(depth[0]>=0)face([[x+w,y,0],[x+w,y+t,0],[x+w,y+t,h],[x+w,y,h]],colors[0]);else face([[x,y,0],[x,y+t,0],[x,y+t,h],[x,y,h]],colors[0]);if(depth[1]>=0)face([[x,y+t,0],[x+w,y+t,0],[x+w,y+t,h],[x,y+t,h]],colors[1]);else face([[x,y,0],[x+w,y,0],[x+w,y,h],[x,y,h]],colors[1]);face([[x,y,h],[x+w,y,h],[x+w,y+t,h],[x,y+t,h]],colors[2]);}
  const fontPx=Math.max(12,Math.min(14,rect.width/85));ctx.fillStyle='#1c294b';ctx.font=(fontPx/factor)+'px Arial,"Microsoft YaHei",sans-serif';ctx.strokeStyle='#71808c';ctx.lineWidth=.8/factor;const label=(text,v,dx=0,dy=0)=>ctx.fillText(text,v[0]+dx/factor,v[1]+dy/factor),front=group.count*2.42,compact=rect.width<600;line(p(0,front,0),p(1485,front,0));label('X · 第1—75天',p(640,front,0),0,40);for(const d of (compact?[1,15,31,46,61,75]:[1,8,15,31,46,61,75]))label(String(d),p((d-1)*19.8,front,0),-4,16);line(p(-90,0,0),p(-90,(group.count-1)*2.42,0));label('Y',p(-90,0,0),-12,-12);for(const r of [...new Set(compact?[1,Math.max(1,Math.ceil(group.count/2)),group.count]:[1,...[50,100,150,200].filter(n=>n<group.count),group.count])])label(String(r),p(-155,(r-1)*2.42,0));if(Math.abs(pitch-figmaTopPitch)>.06){line(p(1550,0,0),p(1550,0,450));label('Z · 填写量',p(1550,0,500));for(let z=0;z<=450;z+=compact?225:90)label(Math.round(z/450*100)+'%',p(1570,0,z));}ctx.restore();
  canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.yaw=yaw.toFixed(4);canvas.dataset.pitch=pitch.toFixed(4);canvas.dataset.barCount=String(cells.length);canvas.dataset.modelCount=String(group.count);options.onState?.({yaw,pitch,zoom,panX,panY});
 }
 function schedule(){if(!raf&&!disposed&&active)raf=requestAnimationFrame(draw);}
 function setZoom(value){zoom=Math.max(.5,Math.min(5,value));onZoom(zoom);schedule();}
 function reset(){yaw=0;pitch=0;panX=0;panY=0;setZoom(1);}
 function setView(name){yaw=0;pitch=name==='top'?figmaTopPitch:name==='side'?.43:0;panX=0;panY=0;setZoom(1);}
 const down=e=>{if(e.pointerType!=='touch'&&e.button!==0)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,panX,panY,pan:e.shiftKey};if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};}};
 const move=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const a=[...pointers.values()];setZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));return;}if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.pan){panX=drag.panX+dx;panY=drag.panY+dy;}else{yaw=drag.yaw+dx*.006;pitch=clampPitch(drag.pitch+dy*.004);}schedule();};
 const up=e=>{pointers.delete(e.pointerId);drag=null;pinch=null;};
 const wheel=e=>{if(options.wheelModifier&&!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));};
 const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-','='].includes(e.key))return;e.preventDefault();if(e.key==='Home')reset();else if(['+','=','-'].includes(e.key))setZoom(zoom+(e.key==='-'?-.25:.25));else if(e.shiftKey){panX+=e.key==='ArrowLeft'?-25:e.key==='ArrowRight'?25:0;panY+=e.key==='ArrowUp'?-25:e.key==='ArrowDown'?25:0;schedule();}else{yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pitch=clampPitch(pitch+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0));schedule();}};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);const observer=new ResizeObserver(schedule);observer.observe(canvas);schedule();
 return {setZoom,reset,setView,setActive(value){active=value;if(!active&&raf){cancelAnimationFrame(raf);raf=0;}if(active)schedule();},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('lostpointercapture',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);}};
}

function mountInlineFigmaModels(){
 document.querySelectorAll('.figma-pattern').forEach(section=>{const index=Number(section.dataset.modelGroup),group=figmaModels[index],chart=figmaCharts.find(c=>c[0]==='pattern-'+(index+1)),originalFigure=section.querySelector('.figma-figure'),tools=section.querySelector('.figma-model-tools');
  const header=document.createElement('div');header.className='inline-model-heading';header.innerHTML='<p class="eyebrow">RECORDING PATTERN / '+String(index+1).padStart(2,'0')+'</p><h3>'+chart[2]+'</h3><p>X：D01—D75　Y：组内用户序位　Z：用户填写量（0—100%）</p>';section.prepend(header);
  tools.innerHTML='<span>拖动旋转，选择视角，放大查看每一天。</span><button data-model-open="'+index+'" type="button">放大模型 ↗</button>';header.insertAdjacentElement('afterend',tools);
  originalFigure.remove();
  const panel=document.createElement('div');panel.className='inline-model-panel';panel.innerHTML='<div class="inline-model-controls"><div class="inline-model-presets segmented" aria-label="模型视角"><button type="button" data-inline-view="default" aria-pressed="true">默认视角</button><button type="button" data-inline-view="top" aria-pressed="false">俯视</button><button type="button" data-inline-view="side" aria-pressed="false">侧看</button></div><div class="inline-model-zoom"><button type="button" data-inline-action="out" aria-label="缩小模型">−</button><output aria-label="缩放比例">100%</output><button type="button" data-inline-action="in" aria-label="放大模型">＋</button><button type="button" data-inline-action="reset">复位</button></div></div><canvas class="inline-model-canvas" tabindex="0" role="application" aria-label="'+chart[2]+'，可拖动旋转，Shift拖动平移，加减号缩放，Home复位"></canvas><div class="inline-model-state" role="status"></div><p class="inline-model-help">拖动旋转 · Shift 拖动或 Shift＋方向键平移 · Ctrl / ⌘＋滚轮缩放 · 双指缩放 · Home 复位。缺失格不补柱；组内行序不是人物 ID。</p>';tools.insertAdjacentElement('afterend',panel);
  const canvas=panel.querySelector('canvas'),output=panel.querySelector('output'),readout=panel.querySelector('.inline-model-state');let controller=null,zoom=1;
  const get=()=>{if(!controller)controller=createFigmaModel(canvas,group,value=>{zoom=value;output.value=Math.round(value*100)+'%';},{wheelModifier:true,onState:state=>{readout.textContent=group.count+' 人 · '+group.barCount.toLocaleString()+' 根原始柱 · 旋转 '+Math.round(state.yaw*180/Math.PI)+'° · 缩放 '+Math.round(state.zoom*100)+'%';panel.querySelectorAll('[data-inline-view]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(state.yaw)<.01&&(b.dataset.inlineView==='top'?Math.abs(state.pitch-figmaTopPitch)<.02:b.dataset.inlineView==='side'?Math.abs(state.pitch-.43)<.02:Math.abs(state.pitch)<.02))));}});return controller;};
  section.addEventListener('click',e=>{const t=e.target.closest('[data-inline-action],[data-inline-view]');if(!t)return;e.preventDefault();const model=get();if(t.dataset.inlineView)model.setView(t.dataset.inlineView);else if(t.dataset.inlineAction==='reset')model.reset();else model.setZoom(zoom+(t.dataset.inlineAction==='in'?.25:-.25));});
  const visibility=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&!panel.hidden)get().setActive(true);else controller?.setActive(false);}},{rootMargin:'160px'});visibility.observe(canvas);
 });
}
