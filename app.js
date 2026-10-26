import {finite,mean,fmt,color,escapeHTML as esc,parseSelection,windowStats,scoreLayers,readRoute} from './data-utils.js';
import {tile,radial,avatar,timeline,scatter,personColors} from './charts.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let data,people,validIds,selection=[],activePerson=null,flipped=false,detailMetric=-1,archivePage=0,mosaicMode='tiles',zoom=1,posterZoom=1,alignment='raw',compareMetric=0,dayStart=1,dayEnd=75;
let toastTimer,returnFocus=null,returnPersonId=null,routePage='home';
const personDialog=$('#person-dialog'),posterDialog=$('#poster-dialog');
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
  compareMetric=Math.min(7,Math.max(0,Number(route.params.get('metric'))||0));alignment=route.params.get('align')==='centered'?'centered':'raw';
  const start=Number(route.params.get('start')),end=Number(route.params.get('end'));
  dayStart=Math.min(75,Math.max(1,Number.isFinite(start)&&start>0?Math.round(start):1));dayEnd=Math.min(75,Math.max(dayStart,Number.isFinite(end)&&end>0?Math.round(end):75));
 }
 const page=['home','overview'].includes(route.page)?'overview':route.page;
 $$('[data-page]').forEach(el=>el.hidden=el.dataset.page!==page);
 $$('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#tooltip').hidden=true;
 if(page==='archives')renderArchives();if(page==='compare')renderComparison();
 renderSelection();
 if(scroll){if(route.page==='overview')requestAnimationFrame(()=>$('#overview').scrollIntoView({behavior:'instant'}));else window.scrollTo({top:0,behavior:'instant'});}
 if(route.person){if(activePerson?.id!==route.person||!personDialog.open)showPerson(people.get(route.person));setFlip(route.flipped,false);}
 else if(personDialog.open){personDialog.close();activePerson=null;restoreFocus();}
 if(page==='overview')requestAnimationFrame(renderHero);
 document.title=route.person?`${people.get(route.person).displayId} · 人物档案 | 看见孤独`:({home:'515个人，75天',overview:'515人的日常',archives:'走近一个人的日常',compare:'日常对照',method:'数据与读图说明'}[route.page]+' · 看见孤独');
}
function openPerson(id,trigger){const p=people.get(Number(id));if(!p)return;returnFocus=trigger||document.activeElement;returnPersonId=p.id;go(`#archives?person=${p.id}`,{scroll:!['archives'].includes(routePage)});}
function closePerson(){if(!personDialog.open)return;personDialog.close();activePerson=null;const r=readRoute(location.hash,validIds);r.params.delete('person');r.params.delete('flip');go('#'+r.page+(r.params.size?'?'+r.params.toString():''),{replace:true,scroll:false});restoreFocus();}
function restoreFocus(){
 const target=routePage==='archives'?($(`#archive-${returnPersonId} .archive-open`)||$('#person-search')):returnFocus;
 if(target?.isConnected&&!target.closest('[hidden]'))target.focus({preventScroll:true});
 returnFocus=null;returnPersonId=null;
}
function renderHero(){
 const field=$('#hero-field');if(field.closest('[hidden]'))return;
 const W=field.clientWidth,H=field.clientHeight,box=$('.hero-copy').getBoundingClientRect(),base=field.getBoundingClientRect();
 const safe={x:box.left-base.left-35,y:box.top-base.top-24,w:box.width+70,h:box.height+55};
 let pitch=Math.min(36,Math.sqrt(Math.max(1,W*(H-100)-safe.w*safe.h)/680)),slots=[];
 for(let attempt=0;attempt<5;attempt++){
  slots=[];
  for(let y=22;y<H-86;y+=pitch)for(let x=35;x<W-30;x+=pitch){const size=pitch*.72;if(x+size>safe.x&&x<safe.x+safe.w&&y+size>safe.y&&y<safe.y+safe.h)continue;slots.push({x,y,size,key:Math.sin(x*1.71+y*3.27)*10000%1});}
  if(slots.length>=515)break;pitch*=.86;
 }
 slots.sort((a,b)=>a.key-b.key);slots=slots.slice(0,515).sort((a,b)=>a.y-b.y||a.x-b.x);
 const markup=slots.map((s,i)=>{const p=data.people[(i*137)%515],angle=Math.round(Math.sin(i*3.7)*9);return `<a href="#archives?person=${p.id}" data-person="${p.id}" tabindex="-1" class="hero-tile" aria-label="${personLabel(p)}" transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${angle} ${s.size/2} ${s.size/2})"><use href="assets/tiles.svg#tile-${p.id}" width="${s.size.toFixed(1)}" height="${s.size.toFixed(1)}"/><title>编号 ${p.displayId} · 点击走近这个人</title></a>`;}).join('');
 field.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${slots.length}位参与者的真实75天数据格围绕标题；全部人物可在下方总览通过键盘访问">${markup}</svg>`;
}
function renderMosaic(){
 const grid=$('#mosaic');grid.classList.toggle('matrix',mosaicMode==='matrix');
 grid.innerHTML=data.order.map((id,i)=>{const p=people.get(id),pressed=selection.includes(id);return mosaicMode==='tiles'?`<button class="person-tile" data-person="${id}" data-index="${i}" tabindex="${i===0?0:-1}" aria-label="${personLabel(p)}" aria-pressed="${pressed}">${tile(p)}</button>`:`<button class="matrix-row" data-person="${id}" data-index="${i}" tabindex="${i===0?0:-1}" aria-label="${personLabel(p)}"><span class="matrix-id">${p.displayId}</span>${p.heat.map((v,j)=>`<span style="background:${color(v)}" title="D${j+1}：${finite(v)?fmt(v)+'分':'缺失'}"></span>`).join('')}</button>`;}).join('');
 updateZoom();
}
function updateZoom(){zoom=Math.min(4,Math.max(1,zoom));$('#mosaic').style.width=zoom*100+'%';$('#zoom-label').textContent=Math.round(zoom*100)+'%';$('#zoom-out').disabled=zoom<=1;$('#zoom-in').disabled=zoom>=4;}
function renderDemographics(){
 const palettes=[['#398194','#ebad9d','#a7ae6c','#d6d9ce'],['#9faaa0','#86b7a4','#dfbf72','#6d9ba7','#b4a1a7','#869169','#d6d9ce'],['#b9c67f','#87b2ab','#e7cf8d','#d6d9ce'],['#e3ca72','#94b28b','#839fbc','#d6d9ce'],['#8ca7b6','#bbbd83','#d8b3a1','#95b19c','#9b8da9','#d6d9ce']];
 const keys=[['gender','性别'],['income','年收入 · 美元'],['living','居住情境'],['relationship','婚恋状态'],['parent','子女与同住']];
 $('#demographics').innerHTML=keys.map(([key,label],index)=>{
  const counts=new Map();data.people.forEach(p=>{const v=p.profile[key];counts.set(v,(counts.get(v)||0)+1);});
  const entries=[...counts].sort((a,b)=>(a[0]==='未报告')-(b[0]==='未报告')||b[1]-a[1]);let total=0;
  const bands=entries.map(([name,n],i)=>{const from=total/515*100;total+=n;return `${palettes[index][i%palettes[index].length]} ${from}% ${total/515*100}%`;});
  return `<div class="demo-block"><div class="demo-title">${label}<span>N = 515</span></div><div class="demo-body"><div class="donut" role="img" aria-label="${esc(entries.map(([name,n])=>name+' '+n+'人').join('，'))}" style="background:conic-gradient(${bands.join(',')})"></div><div class="demo-key">${entries.map(([name,n],i)=>`<div><span class="demo-name" title="${esc(name)}"><i style="background:${palettes[index][i%palettes[index].length]}"></i>${esc(name)}</span><b>${(n/515*100).toFixed(1)}%</b></div>`).join('')}</div></div></div>`;
 }).join('');
}
function renderArchives(){
 const query=$('#person-search').value.trim().toLowerCase(),scope=$('#archive-scope').value,sort=$('#archive-sort').value;
 const exact=query?data.people.filter(p=>p.displayId===query||String(p.id)===query):[];
 let entries=exact.length?exact:data.people.filter(p=>(scope==='all'||p.featured)&&(!query||p.displayId.includes(query)||String(p.id).includes(query)));
 if(query&&scope!=='all'&&!entries.length)entries=data.people.filter(p=>p.displayId.includes(query)||String(p.id).includes(query));
 if(sort!=='id')entries.sort((a,b)=>{const x=a.stats[0].mean,y=b.stats[0].mean;if(x===null)return 1;if(y===null)return -1;return sort==='high'?y-x:x-y;});
 const pageSize=scope==='featured'?27:32,pages=Math.max(1,Math.ceil(entries.length/pageSize));archivePage=Math.min(archivePage,pages-1);
 $('#archive-count').textContent=entries.length+' 份档案';
 $('#archive-grid').innerHTML=entries.length?entries.slice(archivePage*pageSize,(archivePage+1)*pageSize).map((p,i)=>`<article class="archive-card" id="archive-${p.id}"><div class="archive-card-header"><span>${String(archivePage*pageSize+i+1).padStart(2,'0')} / ${p.days} 个记录日</span><button data-select="${p.id}" aria-pressed="${selection.includes(p.id)}" aria-label="${selection.includes(p.id)?'移出':'加入'}对比：编号${p.displayId}">${selection.includes(p.id)?'✓':'＋'}</button></div><button class="archive-open" data-person="${p.id}" aria-label="打开${personLabel(p)}">${radial(p,data)}</button><div class="archive-card-footer"><span>${niceDate(p.dates.find(Boolean))}—${niceDate(p.dates.findLast(Boolean))}</span><span>孤独感 <strong>${fmt(p.stats[0].mean)}</strong></span><span class="open-arrow" aria-hidden="true">↗</span></div></article>`).join(''):'<div class="empty-state"><h3>没有找到这个编号。</h3><p>试试展示编号 122，或原始 ID 1122。</p><button class="primary-link" data-reset-search>重置搜索 ↗</button></div>';
 $('#archive-pagination').innerHTML=pages>1?`<button data-page-step="-1" ${archivePage===0?'disabled':''}>← 上一页</button><span>${archivePage+1} / ${pages}</span><button data-page-step="1" ${archivePage===pages-1?'disabled':''}>下一页 →</button>`:'';
}
function toggleSelection(id){
 id=Number(id);if(!validIds.has(id))return;
 if(selection.includes(id))selection=selection.filter(x=>x!==id);else if(selection.length>=4){toast('最多同时对比 4 人，请先移除一位。');return;}else{selection.push(id);toast(`已加入编号 ${people.get(id).displayId} · ${selection.length}/4`);}
 storeSelection();renderSelection();
 if(routePage==='compare')updateCompareUrl();
}
function renderSelection(){
 $('#selection-tray').hidden=!selection.length||routePage==='compare';$('#selection-count').textContent=selection.length+'/4';$('#selected-people').innerHTML=selection.map(id=>`<button class="selected-chip" data-select="${id}" aria-label="移出对比：编号${people.get(id).displayId}">${tile(people.get(id))}<span>${people.get(id).displayId}</span> ×</button>`).join('');$('#compare-link').href='#compare'+selectedUrl();
 $$('[data-select]').forEach(button=>{if(button.classList.contains('selected-chip')||button.classList.contains('remove-comparison'))return;const id=Number(button.dataset.select),yes=selection.includes(id);button.setAttribute('aria-pressed',String(yes));button.setAttribute('aria-label',`${yes?'移出':'加入'}对比：编号${people.get(id).displayId}`);button.textContent=yes?'✓':'＋';});
 $$('.person-tile').forEach(el=>el.setAttribute('aria-pressed',String(selection.includes(Number(el.dataset.person)))));
 if(activePerson)updateSelectButton();
}
function updateSelectButton(){const yes=selection.includes(activePerson.id);$('#select-person').textContent=yes?'✓ 已加入 · 点击移除':'＋ 加入对比';$('#select-person').setAttribute('aria-pressed',String(yes));}
function showPerson(p){
 activePerson=p;detailMetric=-1;
 $('#card-front').innerHTML=`${radial(p,data)}<div class="card-front-side"><div><span class="card-kicker">PERSONAL ARCHIVE</span><h3>${p.displayId}</h3><p>原始 ID ${p.id}</p></div><div class="card-front-stats"><span>孤独感 · 单题均值<strong>${fmt(p.stats[0].mean)}</strong></span><span>单题有效日数<strong>${p.stats[0].n}<small> / 75</small></strong></span></div><div>${tile(p,'card-mini-tile')}<span class="card-kicker">YOUR PIXEL DIARY</span></div></div>`;
 const profile=[['ID / 展示编号',`${p.displayId} · 原始 ${p.id}`],['性别 / Gender',p.profile.gender],['年龄 / Age',finite(p.profile.age)?p.profile.age+' 岁':'未报告'],['年收入 / USD',p.profile.income],['居住 / Living',p.profile.living],['婚恋 / Relationship',p.profile.relationship],['子女 / Children',p.profile.parent]];
 $('#card-back').innerHTML=`<div class="id-header"><h3>看见孤独<span style="font-size:12px;margin-left:6px">档案卡</span></h3><span class="id-number">IDENTIFICATION CARD<br>NO. ${p.displayId}</span></div><div class="id-body"><div class="avatar-portrait">${avatar(p)}<span>ILLUSTRATED · NOT A REAL PORTRAIT</span></div><dl class="profile-fields">${profile.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div><div class="id-footnote"><span>基线自报资料 · 仅作背景描述<br>像素小人为编号生成的示意形象，不对应真实外貌</span><span aria-hidden="true">↗</span></div>`;
 $('#person-detail').innerHTML=`<div class="detail-selector"><label for="detail-metric">逐日记录 <span style="color:var(--muted)">D01 → D75</span></label><select id="detail-metric"><option value="-1">总览双题复合分</option>${options(-1)}</select></div><div class="day-heatmap" id="person-heatmap" role="group" aria-label="75天的逐日评分，方向键移动日次"></div><p class="detail-readout" id="detail-readout" aria-live="polite">选择一个日格，查看日期与分数。</p><p class="micro-note">灰色是未报告，不是 0 分。图上实心点为个人均值、横杠为标准差、空心点为精选 27 人均值。卡片展示匿名编号，不作诊断。</p>`;
 $('#person-dialog-title').textContent=`PERSONAL ARCHIVE / ${p.displayId} · ${p.days} 个记录日`;
 renderPersonHeat();updateSelectButton();setFlip(false,false);
 if(!personDialog.open){personDialog.showModal();$('#close-person').focus();}personDialog.scrollTop=0;
}
function setFlip(value,update=true){flipped=value;$('#flip-card').classList.toggle('is-flipped',value);$('#flip-person').setAttribute('aria-pressed',String(value));$('#flip-person').innerHTML=`<span aria-hidden="true">⤾</span> ${value?'翻回 · 看他的日常':'翻面 · 认识这个人'}`;$('#card-front').setAttribute('aria-hidden',String(value));$('#card-front').inert=value;$('#card-back').setAttribute('aria-hidden',String(!value));$('#card-back').inert=!value;
 if(update&&activePerson){const r=readRoute(location.hash,validIds);r.params.set('flip',value?'1':'0');history.replaceState(null,'','#'+r.page+'?'+r.params.toString());}
}
function renderPersonHeat(){
 if(!activePerson)return;const p=activePerson,values=detailMetric<0?p.heat:p.daily.map(r=>r[detailMetric]);
 $('#person-heatmap').innerHTML=values.map((v,i)=>`<button class="day-cell" style="background:${color(v)}" tabindex="${i===0?'0':'-1'}" data-day="${i}" aria-label="D${i+1}，${p.dates[i]||'无日期记录'}，${finite(v)?fmt(v)+'分':'缺失'}"></button>`).join('');
 $('#detail-readout').textContent=`${detailMetric<0?'双题复合分':data.metrics[detailMetric].name} · 有效 ${values.filter(finite).length}/75 天 · 均值 ${fmt(mean(values))} 分`;
}
function readDay(index){if(!activePerson)return;const p=activePerson,v=detailMetric<0?p.heat[index]:p.daily[index][detailMetric];$('#detail-readout').textContent=`D${String(index+1).padStart(2,'0')} · ${p.dates[index]||'没有日期记录'} · ${detailMetric<0?'双题复合分':data.metrics[detailMetric].name}：${finite(v)?fmt(v)+' 分':'缺失（未报告）'}`;}
function compareHash(){const params=new URLSearchParams();params.set('ids',selection.join(','));if(compareMetric)params.set('metric',compareMetric);if(alignment==='centered')params.set('align','centered');if(dayStart!==1)params.set('start',dayStart);if(dayEnd!==75)params.set('end',dayEnd);return '#compare?'+params.toString();}
function updateCompareUrl(){history.replaceState(null,'',compareHash());renderComparison();}
function renderComparison(){
 const chosen=selection.map(id=>people.get(id));$('#compare-metric').value=String(compareMetric);$('#day-start').value=dayStart;$('#day-end').value=dayEnd;
 $$('[data-alignment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.alignment===alignment)));
 $$('[data-preset]').forEach(b=>b.classList.toggle('active',selection.join(',')===b.dataset.preset));
 if(chosen.length<2){$('#comparison-content').innerHTML=`<div class="empty-state"><h3>${chosen.length?'再找一个人，一起看。':'先选两个人，看看不同的日常。'}</h3><p>在人物档案点「＋」，最多同时对比 4 人。<br>也可以从上方两组原海报案例开始。</p><a class="primary-link" href="#archives">去选人物 <span>↗</span></a></div>`;$('#comparison-note').textContent='自选 2—4 人，对照他们的日常轨迹。';return;}
 const range={centered:alignment==='centered',start:dayStart,end:dayEnd};
 const cards=chosen.map(p=>{const s=windowStats(p,compareMetric,dayStart,dayEnd);return `<article class="compare-person"><div class="compare-person-head">${avatar(p,'avatar-small')}<div><h3>${p.displayId}</h3><p>${esc(p.profile.gender)} · ${finite(p.profile.age)?p.profile.age+'岁':'年龄未报告'}<br>${esc(p.profile.living)}</p></div><button data-select="${p.id}" class="remove-comparison" aria-label="移除编号${p.displayId}">×</button></div>${radial(p,data)}<div class="compare-person-summary"><span>${esc(data.metrics[compareMetric].name)}均值<strong>${fmt(s.mean)}</strong></span><span>窗口有效日<strong>${s.n}<small> / ${dayEnd-dayStart+1}</small></strong></span><span>全期标准差<strong>${fmt(p.stats[compareMetric].sd)}</strong></span></div></article>`;}).join('');
 const keys=chosen.map((p,i)=>`<span><i style="background:${personColors[i]}"></i>编号 ${p.displayId} ${i===1?'· 虚线':''}</span>`).join('');
 const bars=data.metrics.map((m,i)=>`<div class="metric-row"><span><i style="display:inline-block;width:8px;height:2px;background:${m.color};margin-right:5px"></i>${m.name}</span>${chosen.map(p=>{const v=windowStats(p,i,dayStart,dayEnd).mean;return `<div class="metric-bar" role="img" aria-label="编号${p.displayId}，${m.name}均值${fmt(v)}"><i style="width:${finite(v)?v*10:0}%;background:${m.color}"></i><b>${fmt(v)}</b></div>`;}).join('')}</div>`).join('');
 let html=`<div class="compare-people" style="--columns:${chosen.length}">${cards}</div><section class="chart-section"><div class="chart-section-head"><h3>把每一天，放回时间里。</h3><span>${data.metrics[compareMetric].name} · ${alignment==='centered'?'减去全期个人均值':'0—10 分'} · 缺失日不连线</span></div>${timeline(chosen,compareMetric,range)}<div class="chart-key">${keys}</div><p class="micro-note">D01—D75 为各自入组日次，不是同一自然日期。点选轨迹上的日值查看数值。${alignment==='centered'?'0 表示该人的全期个人均值，不是原始 0 分。':''}</p></section><section class="chart-section"><div class="chart-section-head"><h3>同一把尺，八种感受。</h3><span>当前日次窗口均值 · 共用 0—10 分刻度 · 圆图仍显示全期记录</span></div><div class="metric-comparison" style="--columns:${chosen.length}">${bars}</div></section>`;
 if(chosen.length===2){const layers=chosen.map(p=>scoreLayers(p,dayStart,dayEnd));html+=`<section class="chart-section"><div class="chart-section-head"><h3>同样的孤独评分，对应怎样的互动？</h3><span>按单题整数评分分层，不按日期配对</span></div><div class="table-scroll"><table class="score-mirror"><caption class="sr-only">两位参与者在各孤独评分层内的互动与回应均分</caption><thead><tr><th>孤独评分</th>${chosen.map(p=>`<th>编号 ${p.displayId} · 天数</th><th>互动 / 回应（均分）</th>`).join('')}</tr></thead><tbody>${Array.from({length:11},(_,score)=>`<tr class="${layers.every(a=>a[score].n>=5)?'supported':''}"><td class="score-number">${score}</td>${layers.map(a=>{const s=a[score];return `<td>n=${s.n}${s.n>0&&s.n<5?' †':''}</td><td><div class="mirror-bands"><i style="width:${finite(s.interaction)?s.interaction*6:0}%"></i><i style="width:${finite(s.responsiveness)?s.responsiveness*6:0}%"></i></div>${fmt(s.interaction)} / ${fmt(s.responsiveness)}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="micro-note">浅底表示两侧各至少 5 个该评分日，仅是阅读提示。† 少于 5 天；— 无有效值，不等于 0。重复日均值产生的非整数孤独评分不归入整数层。分层结果不构成匹配、显著性或因果比较。</p></section>`;}
 html+=`<section class="chart-section"><div class="chart-section-head"><h3>比平时更被回应的那天。</h3><span>横轴：回应偏离 · 纵轴：孤独偏离 · 共用 −10 至 +10</span></div><div class="centered-scatter" style="--columns:${chosen.length}">${chosen.map(p=>scatter(p,dayStart,dayEnd)).join('')}</div><p class="micro-note">偏离值 = 当天评分 − 该人的全期个人均值。同日相关只作描述，未控制趋势、自相关或混杂，不说明因果。</p></section>`;
 $('#comparison-content').innerHTML=html;
 const preset=selection.join(',');$('#comparison-note').textContent=preset==='1478,1498'?'478 与 498 的全期孤独感均值同为 3.44，但互动量与回应感不同。相同评分不能替代一个人的具体日常。':preset==='1113,1045'?'113 与 45 的孤独感水平不同。先看个人均值，再看相对各自日常的变化；不把群体水平当作个人基线。':'共同的刻度用于对照，不把曲线差异解释为背景信息的影响或因果关系。';
}
function showPoster(n){posterZoom=1;$('#poster-title').textContent=['','01 / 515人总览','02 / 27人档案','03 / 同分镜像','04 / 个人均值对照'][n];$('#poster-image').src=`assets/poster-${n}.svg`;$('#poster-download').href=`assets/poster-${n}.svg`;updatePosterZoom();posterDialog.showModal();}
function updatePosterZoom(){posterZoom=Math.min(4,Math.max(1,posterZoom));$('#poster-image').style.width=100*posterZoom+'%';$('#poster-scale').textContent=Math.round(posterZoom*100)+'%';}
function showTip(html,event){const tip=$('#tooltip');tip.innerHTML=html;tip.hidden=false;const box=tip.getBoundingClientRect();const x=event.clientX??event.target.getBoundingClientRect().right,y=event.clientY??event.target.getBoundingClientRect().top;tip.style.left=Math.max(8,Math.min(innerWidth-box.width-12,x+15))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-box.height-12,y+15))+'px';}
function bindEvents(){
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,[data-tip]');if(!target)return;
  if(target.matches('[data-person]')){event.preventDefault();$('#tooltip').hidden=true;if(event.shiftKey)toggleSelection(target.dataset.person);else openPerson(target.dataset.person,target);return;}
  if(target.matches('[data-select]')){toggleSelection(target.dataset.select);return;}
  if(target.matches('[data-preset]')){selection=parseSelection(target.dataset.preset,validIds);storeSelection();go('#compare'+selectedUrl(),{scroll:false});return;}
  if(target.matches('[data-mode]')){mosaicMode=target.dataset.mode;$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));renderMosaic();return;}
  if(target.matches('[data-alignment]')){alignment=target.dataset.alignment;updateCompareUrl();return;}
  if(target.matches('[data-page-step]')){archivePage+=Number(target.dataset.pageStep);renderArchives();$('#archive-grid').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(target.matches('[data-reset-search]')){$('#person-search').value='';archivePage=0;renderArchives();$('#person-search').focus();return;}
  if(target.matches('[data-poster]')){showPoster(Number(target.dataset.poster));return;}
  if(target.matches('[data-day]')){readDay(Number(target.dataset.day));return;}
  if(target.matches('[data-tip]')){showTip(esc(target.dataset.tip),event);return;}
  if(target.matches('a[href^="#"]')&&!target.classList.contains('skip-link')){event.preventDefault();go(target.getAttribute('href'));}
 });
 $('#zoom-in').addEventListener('click',()=>{zoom+=.5;updateZoom();});$('#zoom-out').addEventListener('click',()=>{zoom-=.5;updateZoom();});$('#zoom-reset').addEventListener('click',()=>{zoom=1;updateZoom();});
 $('#mosaic-scroll').addEventListener('wheel',event=>{if(!event.ctrlKey)return;event.preventDefault();zoom+=event.deltaY<0?.25:-.25;updateZoom();},{passive:false});
 $('#person-search').addEventListener('input',()=>{archivePage=0;renderArchives();});for(const id of ['archive-scope','archive-sort'])$('#'+id).addEventListener('change',()=>{archivePage=0;renderArchives();});
 $('#close-person').addEventListener('click',closePerson);personDialog.addEventListener('cancel',event=>{event.preventDefault();closePerson();});
 $('#flip-person').addEventListener('click',()=>setFlip(!flipped));$('#flip-card').addEventListener('click',()=>setFlip(!flipped));$('#select-person').addEventListener('click',()=>toggleSelection(activePerson.id));
 personDialog.addEventListener('change',event=>{if(event.target.id==='detail-metric'){detailMetric=Number(event.target.value);renderPersonHeat();}});
 $('#compare-metric').addEventListener('change',event=>{compareMetric=Number(event.target.value);updateCompareUrl();});
 const updateRange=()=>{let a=Number($('#day-start').value),b=Number($('#day-end').value);if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b>75||a>b){toast('请输入 1—75 之间的日次，开始日次不能晚于结束日次。');$('#day-start').value=dayStart;$('#day-end').value=dayEnd;return;}dayStart=a;dayEnd=b;updateCompareUrl();};
 $('#apply-range').addEventListener('click',updateRange);for(const id of ['day-start','day-end'])$('#'+id).addEventListener('keydown',event=>{if(event.key==='Enter')updateRange();});
 $('#clear-comparison').addEventListener('click',()=>{selection=[];storeSelection();renderSelection();updateCompareUrl();});
 $('#close-poster').addEventListener('click',()=>posterDialog.close());$('#poster-plus').addEventListener('click',()=>{posterZoom+=.5;updatePosterZoom();});$('#poster-minus').addEventListener('click',()=>{posterZoom-=.5;updatePosterZoom();});
 for(const dialog of [personDialog,posterDialog])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){if(dialog===personDialog)closePerson();else dialog.close();}});
 document.addEventListener('keydown',event=>{
  const t=event.target;
  if(t.matches('.person-tile,.matrix-row')){
   let step={ArrowRight:1,ArrowLeft:-1,ArrowDown:mosaicMode==='tiles'?23:1,ArrowUp:mosaicMode==='tiles'?-23:-1}[event.key],i=Number(t.dataset.index);
   if(event.key==='Home')i=0;else if(event.key==='End')i=data.order.length-1;else if(step===undefined)return;else i=Math.max(0,Math.min(data.order.length-1,i+step));event.preventDefault();t.tabIndex=-1;const next=$(`#mosaic [data-index="${i}"]`);next.tabIndex=0;next.focus();
  }
  if(t.matches('.day-cell')){
   const step={ArrowRight:1,ArrowLeft:-1,ArrowDown:15,ArrowUp:-15}[event.key];let i=Number(t.dataset.day);
   if(event.key==='Home')i=0;else if(event.key==='End')i=74;else if(step===undefined)return;else i=Math.max(0,Math.min(74,i+step));event.preventDefault();t.tabIndex=-1;const next=$(`#person-heatmap [data-day="${i}"]`);next.tabIndex=0;next.focus();readDay(i);
  }
 });
 document.addEventListener('pointerover',event=>{const el=event.target.closest('[data-person],[data-tip]');if(!el||personDialog.open)return;
  if(el.dataset.person){const p=people.get(Number(el.dataset.person));showTip(`${tile(p,'tip-tile')}<strong>编号 ${p.displayId}</strong>双题均分 ${fmt(p.mean)}<br>有效 ${p.validDays}/75 天<br>点击 · 打开档案`,event);}else showTip(esc(el.dataset.tip),event);
 });
 document.addEventListener('pointerout',event=>{if(event.target.closest('[data-person],[data-tip]'))$('#tooltip').hidden=true;});
 document.addEventListener('focusin',event=>{if(event.target.matches('.day-cell'))readDay(Number(event.target.dataset.day));});
 window.addEventListener('hashchange',()=>renderRoute());
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderHero,160);});
}
async function init(){
 try{
  const response=await fetch(new URL('data/study.json',import.meta.url));if(!response.ok)throw new Error('Data request failed: '+response.status);data=await response.json();
  if(data.people.length!==515||data.meta.windowDays!==75)throw new Error('Study integrity check failed');
  people=new Map(data.people.map(p=>[p.id,p]));validIds=new Set(people.keys());
  try{const stored=JSON.parse(localStorage.getItem('htel-selection')||'[]');if(Array.isArray(stored))selection=parseSelection(stored.join(','),validIds);}catch{selection=[];}
  $('#loading').hidden=true;$('#archive-legend').innerHTML=data.metrics.map((m,i)=>`<span><i style="background:${m.color}"></i><small>0${i+1}</small> ${m.name}</span>`).join('');$('#compare-metric').innerHTML=options();
  renderMosaic();renderDemographics();bindEvents();renderRoute();
 }catch(error){console.error(error);$('#loading').className='error-state';$('#loading').setAttribute('role','alert');$('#loading').innerHTML='<h2>数据暂时没有展开。</h2><p>请通过本地预览服务器或 GitHub Pages 打开网页，不要直接双击 HTML。<br>在项目目录运行 <code>npm start</code>，然后访问 <code>http://127.0.0.1:4173</code>。</p><button class="primary-link" id="retry-load">重新加载 ↗</button>';$('#retry-load').addEventListener('click',()=>location.reload());}
}
init();
