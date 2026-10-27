import {coverageThreshold,coverageEvidence} from './coverage.js';
import {coverageMarkup} from './coverage-view.js';
import {comparisonOptions,fitMosaicWidth,cohortSummary} from './view-utils.js';
import {sortOptions,sortPeople,sortDescription,sortContext} from './sorting.js';
import {finite,mean,fmt,color,metricColor,escapeHTML as esc,parseSelection,windowStats,scoreLayers,readRoute} from './data-utils.js';
import {tile,radial,avatar,timeline,personColors} from './charts.js';
import {createHeroFall} from './hero-motion.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let data,people,validIds,selection=[],activePerson=null,flipped=false,detailMetric=-1,archivePage=0,mosaicMode='tiles',mosaicSort='high',zoom=1,posterZoom=1,alignment='raw',compareMetric=0,dayStart=1,dayEnd=75;
let toastTimer,returnFocus=null,returnPersonId=null,routePage='home';
const personDialog=$('#person-dialog'),posterDialog=$('#poster-dialog');
const heroFall=createHeroFall($('#hero-field'),$('#replay-hero'),matchMedia('(prefers-reduced-motion: reduce)'));
let heroHasPlayed=false,compareView='overview',compareFocus='selected',compareLayout='single',focusedPersonId=null,atlasReturn=null,panState=null,panClickBlockedUntil=0;
const niceDate=(d)=>d?d.slice(5).replace('-','.'):'—';
const personLabel=p=>`编号 ${p.displayId}，原始 ID ${p.id}，${p.validDays} 个有效双题日，均值 ${fmt(p.mean)}`;
const options=(current=0)=>data.metrics.map((m,i)=>`<option value="${i}" ${current===i?'selected':''}>0${i+1} ${m.name}</option>`).join('');
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
function storeSelection(){try{localStorage.setItem('htel-selection',JSON.stringify(selection));}catch{/* Private mode still supports in-memory selection. */}}
function selectedUrl(){return selection.length?'?ids='+selection.join(','):'';}
function go(hash,{replace=false,scroll=true}={}){history[replace?'replaceState':'pushState'](null,'',hash);renderRoute(scroll);}
function renderRoute(scroll=true){
 const route=readRoute(location.hash,validIds);routePage=route.page;
 if(route.selection!==null){selection=route.selection;storeSelection();}
 if(route.page==='compare'){
  const prefs=comparisonOptions(route.params);compareView=prefs.view;compareFocus=prefs.focus;compareLayout=prefs.layout;
  compareMetric=Math.min(7,Math.max(0,Number(route.params.get('metric'))||0));alignment=route.params.get('align')==='centered'?'centered':'raw';
  const start=Number(route.params.get('start')),end=Number(route.params.get('end'));
  dayStart=Math.min(75,Math.max(1,Number.isFinite(start)&&start>0?Math.round(start):1));dayEnd=Math.min(75,Math.max(dayStart,Number.isFinite(end)&&end>0?Math.round(end):75));
 }
 const page=['home','overview'].includes(route.page)?'overview':route.page;
 if(route.page!=='home')heroFall.stop();
 $$('[data-page]').forEach(el=>el.hidden=el.dataset.page!==page);
 $$('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#tooltip').hidden=true;
 if(page==='archives')renderArchives();if(page==='compare')renderComparison();
 if(page==='outsiders'){const limit=coverageThreshold(route.params.get('threshold'));$('#coverage-threshold').value=String(limit);const panel=$('#coverage-content');if(panel.dataset.threshold!==String(limit)){panel.innerHTML=coverageMarkup(data.people,limit);panel.dataset.threshold=String(limit);}$('#coverage-status').textContent=`当前筛选：有效双题记录不超过 ${limit} 天，共 ${data.people.filter(p=>p.validDays<=limit).length} 人。`;}
 renderSelection();
 if(scroll){if(route.page==='overview')requestAnimationFrame(()=>$('#overview').scrollIntoView({behavior:'instant'}));else window.scrollTo({top:0,behavior:'instant'});}
 if(route.person){if(activePerson?.id!==route.person||!personDialog.open)showPerson(people.get(route.person));setFlip(route.flipped,false);}
 else if(personDialog.open){personDialog.close();activePerson=null;restoreFocus();}
 if(page==='overview')requestAnimationFrame(()=>{renderHero();updateZoom();});
 document.title=route.person?`${people.get(route.person).displayId} · 人物档案 | 看见孤独`:({home:'515个人，75天',overview:'515人的日常',archives:'走进个人档案馆',compare:'日常对照',outsiders:'局外人 · 低覆盖的日常',method:'数据与读图说明'}[route.page]+' · 看见孤独');
}
function openPerson(id,trigger){
 const p=people.get(Number(id));if(!p)return;
 returnFocus=trigger||document.activeElement;returnPersonId=p.id;
 if(routePage==='overview'||routePage==='home'){
  const scroller=$('#mosaic-scroll');focusedPersonId=p.id;
  atlasReturn={page:routePage,personId:p.id,zoom,mode:mosaicMode,sort:mosaicSort,left:scroller.scrollLeft,top:scroller.scrollTop,pageY:scrollY};
 }else atlasReturn=null;
 if(routePage==='outsiders'){const params=new URLSearchParams(location.hash.split('?')[1]||'');params.set('person',p.id);params.delete('flip');go('#outsiders?'+params.toString(),{scroll:false});}
 else go(`#archives?person=${p.id}`,{scroll:routePage!=='archives'});
}
function closePerson(){
 if(!personDialog.open)return;
 if(atlasReturn){returnToAtlas();return;}
 personDialog.close();activePerson=null;const r=readRoute(location.hash,validIds);r.params.delete('person');r.params.delete('flip');go('#'+r.page+(r.params.size?'?'+r.params.toString():''),{replace:true,scroll:false});restoreFocus();
}
function returnToAtlas(){
 if(!atlasReturn)return;
 const saved=atlasReturn;atlasReturn=null;personDialog.close();activePerson=null;
 zoom=saved.zoom;mosaicMode=saved.mode;mosaicSort=saved.sort;focusedPersonId=saved.personId;
 $('#overview-sort').value=mosaicSort;
 $$('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mosaicMode)));
 go('#'+saved.page,{replace:true,scroll:false});renderMosaic();
 requestAnimationFrame(()=>{
  const scroller=$('#mosaic-scroll');scroller.scrollLeft=saved.left;scroller.scrollTop=saved.top;
  window.scrollTo({top:saved.pageY,behavior:'instant'});
  if(saved.page==='overview')$(`#mosaic [data-person="${saved.personId}"]`)?.focus({preventScroll:true});
 });
}
function restoreFocus(){
 const target=routePage==='archives'?($(`#archive-${returnPersonId} .archive-open`)||$('#person-search')):returnFocus;
 if(target?.isConnected&&!target.closest('[hidden]'))target.focus({preventScroll:true});
 returnFocus=null;returnPersonId=null;
}
function renderHero(){
 const field=$('#hero-field');if(field.closest('[hidden]'))return;
 heroFall.stop();
 const W=field.clientWidth,H=field.clientHeight,box=$('.hero-copy').getBoundingClientRect(),base=field.getBoundingClientRect();
 const safe={x:box.left-base.left-35,y:box.top-base.top-24,w:box.width+70,h:box.height+55};
 let pitch=Math.min(36,Math.sqrt(Math.max(1,W*(H-100)-safe.w*safe.h)/680)),slots=[];
 for(let attempt=0;attempt<5;attempt++){
  slots=[];
  for(let y=22;y<H-86;y+=pitch)for(let x=35;x<W-30;x+=pitch){const size=pitch*.72;if(x+size>safe.x&&x<safe.x+safe.w&&y+size>safe.y&&y<safe.y+safe.h)continue;slots.push({x,y,size,key:Math.sin(x*1.71+y*3.27)*10000%1});}
  if(slots.length>=515)break;pitch*=.86;
 }
 slots.sort((a,b)=>a.key-b.key);slots=slots.slice(0,515).sort((a,b)=>a.y-b.y||a.x-b.x);
 const markup=slots.map((s,i)=>{const p=data.people[(i*137)%515],angle=Math.round(Math.sin(i*3.7)*9);return `<a href="#archives?person=${p.id}" data-person="${p.id}" tabindex="-1" class="hero-tile" aria-label="${personLabel(p)}" transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${angle} ${s.size/2} ${s.size/2})"><g class="hero-drop" data-y="${s.y.toFixed(1)}" data-size="${s.size.toFixed(1)}"><use href="assets/tiles.svg#tile-${p.id}" width="${s.size.toFixed(1)}" height="${s.size.toFixed(1)}"/></g><title>编号 ${p.displayId} · 点击走近这个人</title></a>`;}).join('');
 const clipHeight=H-75;
 const clearPath=`M0 0H${W}V${clipHeight}H0Z M${safe.x} ${safe.y}V${safe.y+safe.h}H${safe.x+safe.w}V${safe.y}Z`;
 field.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${slots.length}位参与者的真实75天数据格围绕标题；全部人物可在下方总览通过键盘访问"><defs><clipPath id="hero-title-clear"><path d="${clearPath}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#hero-title-clear)">${markup}</g></svg>`;
 if(!heroHasPlayed&&routePage==='home'){heroHasPlayed=true;heroFall.play();}
}
function renderMosaic(){
 const grid=$('#mosaic');grid.classList.toggle('matrix',mosaicMode==='matrix');
 const ordered=sortPeople(data.people,mosaicSort);
 grid.innerHTML=ordered.map((p,i)=>{const id=p.id,pressed=selection.includes(id);return mosaicMode==='tiles'?`<button class="person-tile${focusedPersonId===id?' is-current':''}" data-person="${id}" data-index="${i}" tabindex="${i===0?0:-1}" aria-label="${personLabel(p)}，${esc(sortContext(p,mosaicSort))}" title="${esc(sortContext(p,mosaicSort))}" aria-pressed="${pressed}">${tile(p)}</button>`:`<button class="matrix-row" data-person="${id}" data-index="${i}" tabindex="${i===0?0:-1}" aria-label="${personLabel(p)}，${esc(sortContext(p,mosaicSort))}" aria-pressed="${pressed}"><span class="matrix-id">${p.displayId}</span>${p.heat.map((v,j)=>`<span style="background:${color(v)}" title="D${j+1}：${finite(v)?fmt(v)+'分':'缺失'}"></span>`).join('')}</button>`;}).join('');
 updateZoom();
}
function updateZoom(){
 const scroller=$('#mosaic-scroll'),grid=$('#mosaic');if(!scroller.clientWidth)return;
 zoom=Math.min(4,Math.max(1,zoom));
 const padding=parseFloat(getComputedStyle(scroller).paddingLeft)*2;
 const base=fitMosaicWidth(scroller.clientWidth-padding,scroller.clientHeight-padding,mosaicMode);
 grid.style.width=Math.round(base*zoom)+'px';grid.style.minWidth='0';grid.classList.toggle('is-fit',zoom===1);scroller.classList.toggle('is-zoomed',zoom>1);
 $('#zoom-label').textContent=zoom===1?(mosaicMode==='tiles'?'全图':'适配'):Math.round(zoom*100)+'%';
 $('#zoom-reset').textContent=mosaicMode==='tiles'?'适配全图':'适配宽度';$('#zoom-reset').setAttribute('aria-label',mosaicMode==='tiles'?'适配全图':'适配矩阵宽度');
 $('#zoom-out').disabled=zoom<=1;$('#zoom-in').disabled=zoom>=4;updateMosaicFocus();
}
function changeZoom(amount){
 const scroller=$('#mosaic-scroll'),grid=$('#mosaic');
 const x=(scroller.scrollLeft+scroller.clientWidth/2)/Math.max(1,grid.offsetWidth),y=(scroller.scrollTop+scroller.clientHeight/2)/Math.max(1,grid.offsetHeight);
 zoom+=amount;updateZoom();
 if(zoom===1){scroller.scrollLeft=0;scroller.scrollTop=0;}
 else{scroller.scrollLeft=x*grid.offsetWidth-scroller.clientWidth/2;scroller.scrollTop=y*grid.offsetHeight-scroller.clientHeight/2;}
}
function updateMosaicFocus(){
 const id=focusedPersonId||selection.at(-1);$('#focus-person').disabled=!id;
 $('#mosaic-current').textContent=id?`当前关注 · 编号 ${people.get(id).displayId}`:'先看全图，点一格走近这个人';
}
function focusMosaicPerson(){
 const id=focusedPersonId||selection.at(-1);if(!id)return;
 focusedPersonId=id;zoom=Math.max(zoom,2);renderMosaic();
 const el=$(`#mosaic [data-person="${id}"]`),scroller=$('#mosaic-scroll');
 if(el){scroller.scrollLeft=$('#mosaic').offsetLeft+el.offsetLeft-scroller.clientWidth/2+el.offsetWidth/2;scroller.scrollTop=$('#mosaic').offsetTop+el.offsetTop-scroller.clientHeight/2+el.offsetHeight/2;el.focus({preventScroll:true});}
 scroller.scrollIntoView({block:'center',behavior:'instant'});updateMosaicFocus();
}
function bindMosaicPan(){
 const scroller=$('#mosaic-scroll');
 scroller.addEventListener('pointerdown',event=>{
  if(event.button!==0||(event.pointerType==='touch'&&zoom<=1))return;
  if(scroller.scrollWidth<=scroller.clientWidth&&scroller.scrollHeight<=scroller.clientHeight)return;
  panState={id:event.pointerId,x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop,dragged:false};
 });
 scroller.addEventListener('pointermove',event=>{
  if(!panState||panState.id!==event.pointerId)return;
  const dx=event.clientX-panState.x,dy=event.clientY-panState.y;
  if(!panState.dragged&&Math.hypot(dx,dy)<6)return;
  if(!panState.dragged){panState.dragged=true;scroller.setPointerCapture(event.pointerId);scroller.classList.add('is-panning');$('#tooltip').hidden=true;}
  event.preventDefault();scroller.scrollLeft=panState.left-dx;scroller.scrollTop=panState.top-dy;
 });
 const finish=()=>{if(panState?.dragged)panClickBlockedUntil=performance.now()+250;panState=null;scroller.classList.remove('is-panning');};
 window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
 scroller.addEventListener('pointerleave',()=>{if(!panState?.dragged)panState=null;});
}
function renderArchives(){
 const query=$('#person-search').value.trim().toLowerCase(),scope=$('#archive-scope').value,sort=$('#archive-sort').value;
 const exact=query?data.people.filter(p=>p.displayId===query||String(p.id)===query):[];
 let entries=exact.length?exact:data.people.filter(p=>(scope==='all'||p.featured)&&(!query||p.displayId.includes(query)||String(p.id).includes(query)));
 if(query&&scope!=='all'&&!entries.length)entries=data.people.filter(p=>p.displayId.includes(query)||String(p.id).includes(query));
 entries=sortPeople(entries,sort,'single');
 $('#archive-sort-note').textContent=sortDescription(sort,'single');
 const pageSize=scope==='featured'?27:32,pages=Math.max(1,Math.ceil(entries.length/pageSize));archivePage=Math.min(archivePage,pages-1);
 $('#archive-count').textContent=entries.length+' 份档案';
 $('#archive-grid').innerHTML=entries.length?entries.slice(archivePage*pageSize,(archivePage+1)*pageSize).map((p,i)=>`<article class="archive-card" id="archive-${p.id}"><div class="archive-card-header"><span>${String(archivePage*pageSize+i+1).padStart(2,'0')} / ${p.days} 个记录日</span><button data-select="${p.id}" aria-pressed="${selection.includes(p.id)}" aria-label="${selection.includes(p.id)?'移出':'加入'}对比：编号${p.displayId}">${selection.includes(p.id)?'✓':'＋'}</button></div><button class="archive-open" data-person="${p.id}" aria-label="打开${personLabel(p)}">${radial(p,data)}</button><p class="archive-sort-context">${esc(sortContext(p,sort))}</p><div class="archive-card-footer"><span>${niceDate(p.dates.find(Boolean))}—${niceDate(p.dates.findLast(Boolean))}</span><span>孤独感 <strong>${fmt(p.stats[0].mean)}</strong></span><span class="open-arrow" aria-hidden="true">↗</span></div></article>`).join(''):'<div class="empty-state"><h3>没有找到这个编号。</h3><p>试试展示编号 122，或原始 ID 1122。</p><button class="primary-link" data-reset-search>重置搜索 ↗</button></div>';
 $('#archive-pagination').innerHTML=pages>1?`<button data-page-step="-1" ${archivePage===0?'disabled':''}>← 上一页</button><span>${archivePage+1} / ${pages}</span><button data-page-step="1" ${archivePage===pages-1?'disabled':''}>下一页 →</button>`:'';
}
function toggleSelection(id){
 id=Number(id);if(!validIds.has(id))return;
 if(selection.includes(id))selection=selection.filter(x=>x!==id);else if(selection.length>=4){toast('最多同时对比 4 人，请先移除一位。');return;}else{selection.push(id);toast(`已加入编号 ${people.get(id).displayId} · ${selection.length}/4`);}
 storeSelection();renderSelection();
 if(routePage==='compare')updateCompareUrl();
}
function renderSelection(){
 $('#selection-tray').hidden=!selection.length||!['overview','archives'].includes(routePage);$('#selection-count').textContent=selection.length+'/4';$('#selected-people').innerHTML=selection.map(id=>`<button class="selected-chip" data-select="${id}" aria-label="移出对比：编号${people.get(id).displayId}">${tile(people.get(id))}<span>${people.get(id).displayId}</span> ×</button>`).join('');$('#compare-link').href='#compare'+selectedUrl();
 $$('[data-select]').forEach(button=>{if(button.classList.contains('selected-chip')||button.classList.contains('remove-comparison'))return;const id=Number(button.dataset.select),yes=selection.includes(id);button.setAttribute('aria-pressed',String(yes));button.setAttribute('aria-label',`${yes?'移出':'加入'}对比：编号${people.get(id).displayId}`);button.textContent=yes?'✓':'＋';});
 $$('.person-tile').forEach(el=>el.setAttribute('aria-pressed',String(selection.includes(Number(el.dataset.person)))));
 if(activePerson)updateSelectButton();updateMosaicFocus();
}
function updateSelectButton(){const yes=selection.includes(activePerson.id);$('#select-person').textContent=yes?'✓ 已加入 · 点击移除':'＋ 加入对比';$('#select-person').setAttribute('aria-pressed',String(yes));}
function showPerson(p){
 activePerson=p;detailMetric=0;
 $('#card-front').innerHTML=`${radial(p,data)}<div class="card-front-side"><div><span class="card-kicker">PERSONAL ARCHIVE</span><h3>${p.displayId}</h3><p>原始 ID ${p.id}</p></div><div class="card-front-stats"><span>孤独感 · 单题均值<strong>${fmt(p.stats[0].mean)}</strong></span><span>单题有效日数<strong>${p.stats[0].n}<small> / 75</small></strong></span></div><div>${tile(p,'card-mini-tile')}<span class="card-kicker">YOUR PIXEL DIARY</span></div></div>`;
 const profile=[['ID / 展示编号',`${p.displayId} · 原始 ${p.id}`],['性别 / Gender',p.profile.gender],['年龄 / Age',finite(p.profile.age)?p.profile.age+' 岁':'未报告'],['年收入 / USD',p.profile.income],['居住 / Living',p.profile.living],['婚恋 / Relationship',p.profile.relationship],['子女 / Children',p.profile.parent]];
 $('#card-back').innerHTML=`<div class="id-header"><h3>看见孤独<span style="font-size:12px;margin-left:6px">档案卡</span></h3><span class="id-number">IDENTIFICATION CARD<br>NO. ${p.displayId}</span></div><div class="id-body"><div class="avatar-portrait">${avatar(p)}<span>ILLUSTRATED · NOT A REAL PORTRAIT</span></div><dl class="profile-fields">${profile.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div><div class="id-footnote"><span>基线自报资料 · 仅作背景描述<br>像素小人为编号生成的示意形象，不对应真实外貌</span><span aria-hidden="true">↗</span></div>`;
 $('#person-detail').innerHTML=`<div class="detail-selector"><label for="detail-metric">逐日记录 <span style="color:var(--muted)">D01 → D75</span></label><select id="detail-metric"><option value="-1">总览双题复合分 · 与总览格子对应</option>${options(0)}</select></div><div class="day-heatmap" id="person-heatmap" role="group" aria-label="75天的逐日评分，方向键移动日次"></div><div id="detail-color-scale" class="detail-color-scale" aria-label="当前指标的评分色阶"></div><p class="detail-readout" id="detail-readout" aria-live="polite">选择一个日格，查看日期与分数。</p><p class="micro-note">灰色是未报告，不是 0 分。图上实心点为个人均值、横杠为标准差、空心点为精选 27 人均值。卡片展示匿名编号，不作诊断。</p>`;
 $('#person-dialog-title').textContent=`PERSONAL ARCHIVE / ${p.displayId} · ${p.days} 个记录日`;
 $('#return-to-atlas').hidden=!atlasReturn;renderPersonHeat();updateSelectButton();setFlip(false,false);
 if(!personDialog.open){personDialog.showModal();$('#close-person').focus();}fitProfileCard();personDialog.scrollTop=0;
}
function fitProfileCard(){
 const card=$('#flip-card'),back=$('#card-back'),front=$('#card-front');card.style.height='';
 const base=card.getBoundingClientRect().height,required=Math.max(back.scrollHeight+back.offsetHeight-back.clientHeight,front.scrollHeight+front.offsetHeight-front.clientHeight)+6;
 if(required>base)card.style.height=Math.ceil(required)+'px';
}
function setFlip(value,update=true){flipped=value;$('#flip-card').classList.toggle('is-flipped',value);$('#flip-person').setAttribute('aria-pressed',String(value));$('#flip-person').innerHTML=`<span aria-hidden="true">⤾</span> ${value?'翻回 · 看他的日常':'翻面 · 认识这个人'}`;$('#card-front').setAttribute('aria-hidden',String(value));$('#card-front').inert=value;$('#card-back').setAttribute('aria-hidden',String(!value));$('#card-back').inert=!value;
 if(update&&activePerson){const r=readRoute(location.hash,validIds);r.params.set('flip',value?'1':'0');history.replaceState(null,'','#'+r.page+'?'+r.params.toString());}
}
function renderPersonHeat(){
 if(!activePerson)return;
 const p=activePerson,metric=detailMetric<0?null:data.metrics[detailMetric];
 const values=metric?p.daily.map(r=>r[detailMetric]):p.heat;
 const cellColor=value=>metric?metricColor(value,metric.color):color(value);
 $('#person-heatmap').innerHTML=values.map((v,i)=>`<button class="day-cell${finite(v)?'':' is-missing'}" style="background-color:${cellColor(v)}" tabindex="${i===0?'0':'-1'}" data-day="${i}" aria-label="D${i+1}，${p.dates[i]||'无日期记录'}，${finite(v)?fmt(v)+'分':'缺失'}"></button>`).join('');
 const title=metric?`0${detailMetric+1} ${metric.name}`:'双题复合分';
 const gradient=metric?`linear-gradient(90deg,${cellColor(0)},${cellColor(10)})`:'linear-gradient(90deg,#fff5ba 0%,#ffe066 16%,#f7bb38 32%,#72c7cf 41%,#1686bd 53%,#174c94 67%,#10233f 100%)';
 $('#detail-color-scale').innerHTML=`<span class="detail-metric-key"><i style="background:${metric?metric.color:'var(--ink)'}"></i>${esc(title)}</span><span>0</span><i class="detail-scale-ramp" style="background:${gradient}"></i><span>10</span><span class="missing-key">缺失</span>`;
 $('#detail-metric').style.borderColor=metric?metric.color:'var(--line)';
 $('#detail-readout').textContent=`${metric?metric.name:'双题复合分'} · 有效 ${values.filter(finite).length}/75 天 · 均值 ${fmt(mean(values))} 分`;
}
function readDay(index){if(!activePerson)return;const p=activePerson,v=detailMetric<0?p.heat[index]:p.daily[index][detailMetric];$('#person-heatmap .is-active')?.classList.remove('is-active');$(`#person-heatmap [data-day="${index}"]`)?.classList.add('is-active');$('#detail-readout').textContent=`D${String(index+1).padStart(2,'0')} · ${p.dates[index]||'没有日期记录'} · ${detailMetric<0?'双题复合分':data.metrics[detailMetric].name}：${finite(v)?fmt(v)+' 分':'缺失（未报告）'}`;}
function compareHash(){const params=new URLSearchParams();params.set('ids',selection.join(','));if(compareMetric)params.set('metric',compareMetric);if(alignment==='centered')params.set('align','centered');if(dayStart!==1)params.set('start',dayStart);if(dayEnd!==75)params.set('end',dayEnd);if(compareView!=='overview')params.set('view',compareView);if(compareFocus==='all')params.set('focus','all');if(compareLayout==='paired')params.set('layout','paired');return '#compare?'+params.toString();}
function updateCompareUrl(){history.replaceState(null,'',compareHash());renderComparison();}
function renderComparison(){
 const chosen=selection.map(id=>people.get(id)),shownMetric=compareView==='score'?0:compareMetric,metric=data.metrics[compareMetric];
 $('#compare-metric').value=String(shownMetric);$('#compare-metric').disabled=compareView==='score';$('#compare-metric').style.borderColor=data.metrics[shownMetric].color;
 $('#compare-metric').title=compareView==='score'?'同分对照固定按01孤独感分层':'选择两人共同观察的感受';
 $('#day-start').value=dayStart;$('#day-end').value=dayEnd;
 $('#compare-context').textContent=chosen.length?`${chosen.map(p=>p.displayId).join(' × ')} · D${String(dayStart).padStart(2,'0')}—D${String(dayEnd).padStart(2,'0')}`:'先选择 2—4 个人';
 $('#compare-workbench').dataset.view=compareView;
 $('[data-page="compare"]').dataset.mobileLayout=compareLayout;
 $$('[data-compare-view]').forEach(button=>{const yes=button.dataset.compareView===compareView;button.setAttribute('aria-selected',String(yes));button.tabIndex=yes?0:-1;});
 $$('[data-alignment]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.alignment===alignment)));
 $$('[data-preset]').forEach(button=>button.classList.toggle('active',selection.join(',')===button.dataset.preset));
 if(chosen.length<2){$('#comparison-content').innerHTML=`<div class="empty-state"><h3>${chosen.length?'再找一个人，一起看。':'先选两个人，看看不同的日常。'}</h3><p>在人物档案点「＋」，最多同时对比 4 人。也可以从上方两组海报案例开始。</p><a class="primary-link" href="#archives">去选人物 <span>↗</span></a></div>`;$('#comparison-note').textContent='自选 2—4 人，对照他们的日常轨迹。';return;}
 const range={centered:alignment==='centered',start:dayStart,end:dayEnd};
 const summary=chosen.map(p=>{const st=windowStats(p,compareMetric,dayStart,dayEnd);return `<div><span>编号 ${p.displayId}</span><strong>${fmt(st.mean)}</strong><small>${esc(metric.name)} · n=${st.n}</small></div>`;}).join('');
 const cards=chosen.map(p=>{const st=windowStats(p,compareMetric,dayStart,dayEnd);return `<article class="compare-person"><div class="compare-person-head">${avatar(p,'avatar-small')}<div><h3>${p.displayId}</h3><p>${esc(p.profile.gender)} · ${finite(p.profile.age)?p.profile.age+'岁':'年龄未报告'}<br>${esc(p.profile.living)}</p></div><button data-select="${p.id}" class="remove-comparison" aria-label="移除编号${p.displayId}">×</button></div>${radial(p,data,{selectedMetric:compareFocus==='selected'?compareMetric:null})}<div class="compare-person-summary"><span>窗口${esc(metric.name)}均值<strong>${fmt(st.mean)}</strong></span><span>窗口有效日<strong>${st.n}<small> / ${dayEnd-dayStart+1}</small></strong></span><span>全期标准差<strong>${fmt(p.stats[compareMetric].sd)}</strong></span></div></article>`;}).join('');
 const keys=chosen.map((p,i)=>`<span class="timeline-person-key">${avatar(p,'legend-avatar')}<svg class="timeline-key-line" viewBox="0 0 36 12" aria-hidden="true"><path d="M1 6H35" fill="none" stroke="${personColors[i]}" stroke-width="3" ${i===1?'stroke-dasharray="6 3"':''}/></svg><span>编号 ${p.displayId}${i===1?' · 虚线':''}</span></span>`).join('');
 const bars=data.metrics.map((m,i)=>`<div class="metric-row"><span><i class="metric-square" style="background:${m.color}"></i>${m.name}</span>${chosen.map(p=>{const v=windowStats(p,i,dayStart,dayEnd).mean;return `<div class="metric-bar" role="img" aria-label="编号${p.displayId}，${m.name}均值${fmt(v)}"><i style="width:${finite(v)?v*10:0}%;background:${m.color}"></i><b>${fmt(v)}</b></div>`;}).join('')}</div>`).join('');
 const overview=`<div class="compare-overview-actions"><p class="compare-focus-note" role="status"><span><i style="background:${metric.color}"></i>0${compareMetric+1} ${esc(metric.name)}</span>${compareFocus==='selected'?'同步突出所选感受':'显示全部八项指标'} · 圆图保留全期记录</p><div class="segmented" aria-label="圆图高亮方式"><button data-compare-focus="selected" aria-pressed="${compareFocus==='selected'}">突出所选</button><button data-compare-focus="all" aria-pressed="${compareFocus==='all'}">显示全部</button></div><div class="segmented mobile-chart-layout" aria-label="手机圆图布局"><button data-compare-layout="paired" aria-pressed="${compareLayout==='paired'}">并排</button><button data-compare-layout="single" aria-pressed="${compareLayout==='single'}">单张放大</button></div></div><div class="mobile-compare-summary" style="--columns:${chosen.length}">${summary}</div><div class="compare-people" style="--columns:${chosen.length}">${cards}</div><p class="micro-note">圆图颜色区分八项指标；圆图与全期标准差使用全部 D01—D75 记录，窗口均值与有效日数使用上方日次范围。</p><section class="chart-section"><div class="chart-section-head"><h3>同一把尺，八种感受。</h3><span>当前窗口均值 · 共用 0—10 分刻度</span></div><div class="metric-comparison" style="--columns:${chosen.length}">${bars}</div></section>`;
 const daily=`<section class="chart-section"><div class="chart-section-head"><h3>把每一天，放回时间里。</h3><span>${esc(metric.name)} · ${alignment==='centered'?'减去全期个人均值':'0—10 分'} · 缺失日不连线</span></div><p class="timeline-axis-label">横轴：各自入组日次 · 纵轴：${esc(metric.name)}${alignment==='centered'?'相对个人均值的偏离':'评分'}</p>${timeline(chosen,compareMetric,range)}<div class="chart-key">${keys}</div><p class="micro-note">本图颜色区分人物，线型作辅助；不是圆图的指标配色。D01—D75 是各自入组日次，不是同一自然日期。点选轨迹日值查看分数。${alignment==='centered'?'0 表示全期个人均值，不是原始0分。':''}</p></section>`;
 let scoreHtml='<div class="empty-state"><h3>同分对照，请恰好选两个人。</h3><p>保留当前选择，可先查看「日常轮廓」或「逐日变化」。</p></div>';
 if(chosen.length===2){const layers=chosen.map(p=>scoreLayers(p,dayStart,dayEnd));scoreHtml=`<section class="chart-section score-section"><div class="chart-section-head"><h3>同样的孤独评分，对应怎样的互动？</h3><span>按单题整数评分分层，不按日期配对</span></div><div class="table-scroll"><table class="score-mirror"><caption class="sr-only">两位参与者在各孤独评分层内的互动与回应均分</caption><thead><tr><th>孤独评分</th>${chosen.map(p=>`<th scope="col"><span class="score-person-heading">${avatar(p,'table-avatar')}<span>编号 ${p.displayId} · 天数</span></span></th><th>互动 / 回应（均分）</th>`).join('')}</tr></thead><tbody>${Array.from({length:11},(_,score)=>`<tr class="${layers.every(a=>a[score].n>=5)?'supported':''}"><td class="score-number">${score}</td>${layers.map(a=>{const s=a[score];return `<td>n=${s.n}${s.n>0&&s.n<5?' †':''}</td><td><div class="mirror-bands"><i style="width:${finite(s.interaction)?s.interaction*6:0}%"></i><i style="width:${finite(s.responsiveness)?s.responsiveness*6:0}%"></i></div>${fmt(s.interaction)} / ${fmt(s.responsiveness)}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="micro-note">浅底表示两侧各至少 5 个该评分日，仅是阅读提示。† 少于 5 天；— 无有效值，不等于 0。重复日均值产生的非整数孤独评分不归入整数层。分层结果不构成匹配、显著性或因果比较。</p></section>`;}

 $('#comparison-content').innerHTML=`<section id="compare-view-overview" class="compare-panel" role="tabpanel" aria-labelledby="compare-tab-overview" ${compareView==='overview'?'':'hidden'}>${overview}</section><section id="compare-view-daily" class="compare-panel" role="tabpanel" aria-labelledby="compare-tab-daily" ${compareView==='daily'?'':'hidden'}>${daily}</section><section id="compare-view-score" class="compare-panel" role="tabpanel" aria-labelledby="compare-tab-score" ${compareView==='score'?'':'hidden'}><p class="panel-explanation">本视图固定按「01 孤独感」的整数评分分层，比较互动与回应；不是按日期配对，也不构成因果或显著性判断。</p>${scoreHtml}</section>`;
 const preset=selection.join(',');$('#comparison-note').textContent=preset==='1478,1498'?'478 与 498 的全期孤独感均值同为3.44，但互动量与回应感不同。相同评分不能替代具体日常。':preset==='1113,1045'?'113 与45的孤独感水平不同。先看个人均值，再看相对各自日常的变化。':'共同刻度用于描述性对照，不将曲线差异解释为因果关系。';
}
function showPoster(n){posterZoom=1;$('#poster-title').textContent=['','01 / 515人总览','02 / 27人档案','03 / 同分镜像','04 / 个人均值对照'][n];$('#poster-image').src=`assets/poster-${n}.svg`;$('#poster-download').href=`assets/poster-${n}.svg`;$('#poster-download').download=`看见孤独_海报${n}.svg`;updatePosterZoom();posterDialog.showModal();}
function updatePosterZoom(){posterZoom=Math.min(4,Math.max(1,posterZoom));$('#poster-image').style.width=100*posterZoom+'%';$('#poster-scale').textContent=Math.round(posterZoom*100)+'%';}
function showTip(html,event){const tip=$('#tooltip');tip.innerHTML=html;tip.hidden=false;const box=tip.getBoundingClientRect();const x=event.clientX??event.target.getBoundingClientRect().right,y=event.clientY??event.target.getBoundingClientRect().top;tip.style.left=Math.max(8,Math.min(innerWidth-box.width-12,x+15))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-box.height-12,y+15))+'px';}
function bindEvents(){
 $('#overview-sort').addEventListener('change',()=>{mosaicSort=$('#overview-sort').value;renderMosaic();$('#mosaic-scroll').scrollTop=0;});
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,[data-tip]');if(!target)return;
  if(target.matches('[data-person]')){event.preventDefault();if(target.closest('#mosaic')&&performance.now()<panClickBlockedUntil)return;$('#tooltip').hidden=true;if(event.shiftKey)toggleSelection(target.dataset.person);else openPerson(target.dataset.person,target);return;}
  if(target.matches('[data-select]')){toggleSelection(target.dataset.select);return;}
  if(target.matches('[data-preset]')){selection=parseSelection(target.dataset.preset,validIds);storeSelection();go('#compare'+selectedUrl(),{scroll:false});return;}
  if(target.matches('[data-mode]')){mosaicMode=target.dataset.mode;zoom=1;$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));renderMosaic();return;}
  if(target.matches('[data-compare-view]')){compareView=target.dataset.compareView;updateCompareUrl();return;}
  if(target.matches('[data-compare-focus]')){compareFocus=target.dataset.compareFocus;updateCompareUrl();$(`[data-compare-focus="${compareFocus}"]`)?.focus({preventScroll:true});return;}
  if(target.matches('[data-compare-layout]')){compareLayout=target.dataset.compareLayout;updateCompareUrl();$(`[data-compare-layout="${compareLayout}"]`)?.focus({preventScroll:true});return;}
  if(target.matches('[data-alignment]')){alignment=target.dataset.alignment;updateCompareUrl();return;}
  if(target.matches('[data-page-step]')){archivePage+=Number(target.dataset.pageStep);renderArchives();$('#archive-grid').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(target.matches('[data-reset-search]')){$('#person-search').value='';archivePage=0;renderArchives();$('#person-search').focus();return;}
  if(target.matches('[data-poster]')){showPoster(Number(target.dataset.poster));return;}
  if(target.matches('[data-day]')){readDay(Number(target.dataset.day));return;}
  if(target.matches('[data-tip]')){showTip(esc(target.dataset.tip),event);return;}
  if(target.matches('a[href^="#"]')&&!target.classList.contains('skip-link')){event.preventDefault();go(target.getAttribute('href'));}
 });
 $('#zoom-in').addEventListener('click',()=>changeZoom(.5));$('#zoom-out').addEventListener('click',()=>changeZoom(-.5));$('#zoom-reset').addEventListener('click',()=>{zoom=1;updateZoom();$('#mosaic-scroll').scrollLeft=0;$('#mosaic-scroll').scrollTop=0;$('#mosaic-scroll').scrollIntoView({block:'center',behavior:'instant'});});$('#focus-person').addEventListener('click',focusMosaicPerson);bindMosaicPan();
 $('#mosaic-scroll').addEventListener('wheel',event=>{if(!event.ctrlKey)return;event.preventDefault();changeZoom(event.deltaY<0?.25:-.25);},{passive:false});
 $('#coverage-jump').addEventListener('click',()=>{const heading=$('#coverage-people-title');heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});});
 $('#coverage-threshold').addEventListener('change',event=>go('#outsiders?threshold='+coverageThreshold(event.target.value),{scroll:false}));
 $('#person-search').addEventListener('input',()=>{archivePage=0;renderArchives();});for(const id of ['archive-scope','archive-sort'])$('#'+id).addEventListener('change',()=>{archivePage=0;renderArchives();});
 $('#close-person').addEventListener('click',closePerson);personDialog.addEventListener('cancel',event=>{event.preventDefault();closePerson();});
 $('#flip-person').addEventListener('click',()=>setFlip(!flipped));$('#flip-card').addEventListener('click',event=>{if(event.target.matches('.card-face,.id-body,.card-front-side')&&!window.getSelection()?.toString())setFlip(!flipped);});$('#return-to-atlas').addEventListener('click',returnToAtlas);$('#jump-to-days').addEventListener('click',()=>{personDialog.scrollTop+=$('#person-detail').getBoundingClientRect().top-personDialog.getBoundingClientRect().top-$('.person-dialog .dialog-toolbar').offsetHeight-8;$('#detail-metric').focus({preventScroll:true});});$('#select-person').addEventListener('click',()=>toggleSelection(activePerson.id));
 personDialog.addEventListener('change',event=>{if(event.target.id==='detail-metric'){detailMetric=Number(event.target.value);renderPersonHeat();}});
 $('#compare-settings-toggle').addEventListener('click',()=>{const expanded=$('#compare-workbench').classList.toggle('is-expanded');$('#compare-settings-toggle').setAttribute('aria-expanded',String(expanded));$('#compare-settings-toggle').textContent=expanded?'收起设置 −':'范围与设置 ＋';});
 $('#compare-metric').addEventListener('change',event=>{compareMetric=Number(event.target.value);updateCompareUrl();});
 const updateRange=()=>{let a=Number($('#day-start').value),b=Number($('#day-end').value);if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b>75||a>b){toast('请输入 1—75 之间的日次，开始日次不能晚于结束日次。');$('#day-start').value=dayStart;$('#day-end').value=dayEnd;return;}dayStart=a;dayEnd=b;updateCompareUrl();};
 $('#apply-range').addEventListener('click',updateRange);for(const id of ['day-start','day-end'])$('#'+id).addEventListener('keydown',event=>{if(event.key==='Enter')updateRange();});
 $('#clear-comparison').addEventListener('click',()=>{selection=[];storeSelection();renderSelection();updateCompareUrl();});
 $('#close-poster').addEventListener('click',()=>posterDialog.close());$('#poster-plus').addEventListener('click',()=>{posterZoom+=.5;updatePosterZoom();});$('#poster-minus').addEventListener('click',()=>{posterZoom-=.5;updatePosterZoom();});
 for(const dialog of [personDialog,posterDialog])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){if(dialog===personDialog)closePerson();else dialog.close();}});
 document.addEventListener('keydown',event=>{
  const t=event.target;
  if(t.matches('[data-compare-view]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
   const tabs=$$('[data-compare-view]'),current=tabs.indexOf(t);let index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   event.preventDefault();tabs[index].click();tabs[index].focus();return;
  }
  if(t.matches('.person-tile,.matrix-row')){
   let step={ArrowRight:1,ArrowLeft:-1,ArrowDown:mosaicMode==='tiles'?23:1,ArrowUp:mosaicMode==='tiles'?-23:-1}[event.key],i=Number(t.dataset.index);
   if(event.key==='Home')i=0;else if(event.key==='End')i=data.order.length-1;else if(step===undefined)return;else i=Math.max(0,Math.min(data.order.length-1,i+step));event.preventDefault();t.tabIndex=-1;const next=$(`#mosaic [data-index="${i}"]`);next.tabIndex=0;next.focus();
  }
  if(t.matches('.day-cell')){
   const step={ArrowRight:1,ArrowLeft:-1,ArrowDown:15,ArrowUp:-15}[event.key];let i=Number(t.dataset.day);
   if(event.key==='Home')i=0;else if(event.key==='End')i=74;else if(step===undefined)return;else i=Math.max(0,Math.min(74,i+step));event.preventDefault();t.tabIndex=-1;const next=$(`#person-heatmap [data-day="${i}"]`);next.tabIndex=0;next.focus();readDay(i);
  }
 });
 document.addEventListener('pointerover',event=>{if(event.target.matches('.day-cell'))readDay(Number(event.target.dataset.day));const el=event.target.closest('[data-person],[data-tip]');if(!el||personDialog.open)return;
  if(el.dataset.person){const p=people.get(Number(el.dataset.person));showTip(`${tile(p,'tip-tile')}<strong>编号 ${p.displayId}</strong>${esc(sortContext(p,mosaicSort))}<br>双题均分 ${fmt(p.mean)}<br>有效 ${p.validDays}/75 天<br>点击 · 打开档案`,event);}else showTip(esc(el.dataset.tip),event);
 });
 document.addEventListener('pointerout',event=>{if(event.target.closest('[data-person],[data-tip]'))$('#tooltip').hidden=true;});
 document.addEventListener('focusin',event=>{if(event.target.matches('.day-cell'))readDay(Number(event.target.dataset.day));if(event.target.matches('.person-tile,.matrix-row')){focusedPersonId=Number(event.target.dataset.person);$('#mosaic .is-current')?.classList.remove('is-current');event.target.classList.add('is-current');updateMosaicFocus();}});
 personDialog.addEventListener('pointermove',event=>{if(event.pointerType==='touch'&&event.buttons){const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.day-cell');if(cell)readDay(Number(cell.dataset.day));}});
 window.addEventListener('hashchange',()=>renderRoute());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)heroFall.stop();});
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderHero();updateZoom();if(personDialog.open)fitProfileCard();},160);});
}
function initReadingGuide(){
 const choices=sortOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
 $('#overview-sort').innerHTML=choices;$('#overview-sort').value=mosaicSort;
 $('#archive-sort').innerHTML=choices;$('#archive-sort').value='id';
 const cohort=cohortSummary(data.people);
 $('#cohort-explanation').innerHTML=`<div class="cohort-path"><span><strong>${cohort.all}</strong>全部参与者</span><b>→</b><span><strong>${cohort.complete}</strong>记录完成率≥90%</span><b>→</b><span><strong>${cohort.continuous}</strong>记录连续的档案</span></div><p>按有效日期计算：D01—D75 至少有68天提交且至少填写一项日记指标，再选出这些记录全部落在一段连续日次里的27人。其中${cohort.full}人提交75日、${cohort.nearFull}人提交74日。</p><p>有效日期指：提交且有填写内容的天数。</p>`;
 const p=people.get(1478);
 $('#radial-guide-example').innerHTML=radial(p,data);
 $('#tile-example').innerHTML=`<div class="example-top"><span>D01 → D15</span><span>15 列</span></div>${tile(p,'example-tile')}<div class="example-bottom"><span>逐行向下 ↓</span><span>D61 → D75</span></div>`;
 $('#tile-example-caption').textContent=`真实示例 · 编号 ${p.displayId} · ${p.validDays} 个有效日 · 双题均值 ${fmt(p.mean)}。外圈为底色，内部 75 个小格为逐日记录。`;
}
async function init(){
 try{
  const embedded=document.querySelector('#study-data');if(embedded)data=JSON.parse(embedded.textContent);else{const response=await fetch(new URL('data/study.json',import.meta.url));if(!response.ok)throw new Error('Data request failed: '+response.status);data=await response.json();}
  if(data.people.length!==515||data.meta.windowDays!==75)throw new Error('Study integrity check failed');
  people=new Map(data.people.map(p=>[p.id,p]));validIds=new Set(people.keys());
  try{const stored=JSON.parse(localStorage.getItem('htel-selection')||'[]');if(Array.isArray(stored))selection=parseSelection(stored.join(','),validIds);}catch{selection=[];}
  $('#loading').hidden=true;$('#archive-legend').innerHTML=data.metrics.map((m,i)=>`<span><i style="background:${m.color}"></i><small>0${i+1}</small> ${m.name}</span>`).join('');$('#compare-metric').innerHTML=options();
  const coverage=coverageEvidence(data.people);
  $('#overview-coverage-summary').textContent=`${coverage.low.n} 人的有效双题记录不超过 15 天，占全部 ${(coverage.low.n/data.people.length*100).toFixed(1)}%，却对应 ${(coverage.missingShare*100).toFixed(1)}% 的灰格。灰色不是零分；从这里继续看记录的空白。`;
  initReadingGuide();renderMosaic();bindEvents();renderRoute();
 }catch(error){console.error(error);$('#loading').className='error-state';$('#loading').setAttribute('role','alert');$('#loading').innerHTML='<h2>数据暂时没有展开。</h2><p>请通过本地预览服务器或 GitHub Pages 打开网页，不要直接双击 HTML。<br>在项目目录运行 <code>npm start</code>，然后访问 <code>http://127.0.0.1:4173</code>。</p><button class="primary-link" id="retry-load">重新加载 ↗</button>';$('#retry-load').addEventListener('click',()=>location.reload());}
}
init();
