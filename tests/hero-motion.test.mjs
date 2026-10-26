import test from 'node:test';
import assert from 'node:assert/strict';
import {dropMotion,createHeroFall} from '../hero-motion.js';
function fixture({reduced=false,count=3}={}){
 const animations=[],listeners={},preferenceListeners={};
 const nodes=Array.from({length:count},(_,i)=>({dataset:{y:String(i*25+30),size:'24'},animate(keyframes,timing){const animation={keyframes,timing,cancelled:false,onfinish:null,cancel(){this.cancelled=true;}};animations.push(animation);return animation;}}));
 const field={querySelectorAll:()=>nodes};
 const button={textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){listeners[k]=fn;}};
 const preference={matches:reduced,addEventListener(k,fn){preferenceListeners[k]=fn;}};
 const controller=createHeroFall(field,button,preference);
 return {controller,button,preference,animations,click:()=>listeners.click(),change:()=>preferenceListeners.change()};
}
test('fall motion is deterministic, staggered and finite',()=>{assert.deepEqual(dropMotion(122,480,26),dropMotion(122,480,26));const delays=new Set();for(let i=0;i<515;i++){const m=dropMotion(i,i*1.4,25);assert.equal(m.timing.iterations,1);assert.equal(m.timing.fill,'backwards');assert.ok(m.timing.delay>=0&&m.timing.delay<=1150);assert.ok(m.timing.delay+m.timing.duration<3000);delays.add(m.timing.delay);}assert.ok(delays.size>400);});
test('every tile starts above the hero and settles to its unchanged placement',()=>{for(const y of [22,300,750]){const m=dropMotion(5,y,24);assert.ok(m.keyframes[0].transform.includes(`${-(y+24+70)}px`));assert.equal(m.keyframes.at(-1).offset,1);assert.equal(m.keyframes.at(-1).transform,'translate(0px, 0px) rotate(0deg)');assert.ok(m.keyframes.some(f=>f.offset===.81&&f.transform.includes('-7.68px')));}});
test('entry and replay animate exactly the existing tiles, with a skip action',()=>{const f=fixture({count:515});f.controller.play();assert.equal(f.animations.length,515);assert.equal(f.controller.running,true);assert.match(f.button.textContent,/跳过/);f.click();assert.equal(f.controller.running,false);assert.ok(f.animations.every(a=>a.cancelled));assert.match(f.button.textContent,/重播/);f.click();assert.equal(f.animations.length,1030);});
test('finished animations release effects and restore replay label',()=>{const f=fixture();f.controller.play();for(const a of [...f.animations])a.onfinish();assert.equal(f.controller.running,false);assert.ok(f.animations.every(a=>a.cancelled));assert.match(f.button.textContent,/重播/);});
test('reduced-motion preference skips animation and disables replay',()=>{const f=fixture({reduced:true});f.controller.play();assert.equal(f.animations.length,0);assert.equal(f.button.disabled,true);assert.equal(f.controller.running,false);});
test('changing motion preference cancels active animation immediately',()=>{const f=fixture();f.controller.play();f.preference.matches=true;f.change();assert.equal(f.controller.running,false);assert.equal(f.button.disabled,true);assert.ok(f.animations.every(a=>a.cancelled));});
test('missing WAAPI support leaves a usable static cover',()=>{const button={setAttribute(){},addEventListener(){}};const controller=createHeroFall({querySelectorAll:()=>[{dataset:{y:'10',size:'20'}}]},button,{matches:false,addEventListener(){}});assert.doesNotThrow(()=>controller.play());assert.equal(controller.running,false);});
