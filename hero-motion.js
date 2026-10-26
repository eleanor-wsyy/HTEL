// One-shot, deterministic entry motion; the settled SVG placement remains authoritative.
export function dropMotion(index,y,size){
 const seed=(((index+1)*2654435761)>>>0)/4294967296;
 const distance=Math.max(0,y)+Math.max(1,size)+70;
 const spin=(seed-.5)*78;
 const drift=(seed-.5)*26;
 const bounce=Math.min(13,Math.max(4,size*.32));
 return {
  keyframes:[
   {offset:0,transform:`translate(${drift.toFixed(2)}px, ${-distance}px) rotate(${spin.toFixed(2)}deg)`,easing:'cubic-bezier(.5,0,.85,.45)'},
   {offset:.69,transform:'translate(0px, 0px) rotate(-2deg)',easing:'cubic-bezier(.15,.65,.35,1)'},
   {offset:.81,transform:`translate(0px, ${-bounce}px) rotate(1.5deg)`,easing:'cubic-bezier(.55,0,.85,.45)'},
   {offset:.92,transform:'translate(0px, 2px) rotate(-.5deg)',easing:'ease-out'},
   {offset:1,transform:'translate(0px, 0px) rotate(0deg)'}
  ],
  timing:{duration:Math.round(780+Math.sqrt(distance/850)*690),delay:Math.round(seed*1150),fill:'backwards',iterations:1}
 };
}
export function createHeroFall(field,button,motionPreference){
 let running=[];
 const label=()=>{
  button.textContent=running.length?'跳过动画 ↓':'↻ 重播落下';
  button.setAttribute('aria-label',running.length?'跳过格子落下动画':'重播格子落下动画');
  button.disabled=motionPreference.matches;
  button.title=motionPreference.matches?'已遵循系统的减少动态效果设置':'格子错落落下，轻弹后停稳';
 };
 function stop(){
  for(const animation of running){animation.onfinish=null;animation.cancel();}
  running=[];label();
 }
 function play(){
  stop();
  const nodes=[...field.querySelectorAll('.hero-drop')];
  if(motionPreference.matches||!nodes.length||typeof nodes[0].animate!=='function')return;
  for(const [index,node] of nodes.entries()){
   const {keyframes,timing}=dropMotion(index,Number(node.dataset.y),Number(node.dataset.size));
   const animation=node.animate(keyframes,timing);
   animation.onfinish=()=>{
    animation.onfinish=null;animation.cancel();
    running=running.filter(item=>item!==animation);
    if(!running.length)label();
   };
   running.push(animation);
  }
  label();
 }
 button.addEventListener('click',()=>running.length?stop():play());
 motionPreference.addEventListener('change',stop);
 label();
 return {play,stop,get running(){return running.length>0;}};
}
