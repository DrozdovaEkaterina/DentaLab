import {GUIDE_STEPS} from './learning-ui.js?v=0.8.0';
import {earlyGuideSteps} from './early-coach.js?v=0.8.0';
export function installCoach({state,locate,annotate,onToggle}){
 const card=document.getElementById('case-coach'),toggle=document.getElementById('guide-toggle');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='guide-lines';svg.setAttribute('aria-hidden','true');svg.innerHTML='<defs><marker id="coach-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1 11 6 1 11" fill="none" stroke="#2d8069" stroke-width="2"/></marker></defs><path id="guide-path" marker-end="url(#coach-arrow)"/><circle id="guide-point" r="7"/>';svg.style.display='none';document.body.appendChild(svg);
 let index=0,previousStage=-1,previousCritical=false,previousEarly=false,previousEarlyText='',manualStep=null,lastTarget=null;
 function clear(){lastTarget?.classList.remove('guide-target');lastTarget=null;}
 function steps(){return earlyGuideSteps(state().early)||GUIDE_STEPS[state().stage];}
 function current(){return state().critical?{title:'Остановите обработку',text:'Обнаружено повреждение пульпы. Выключите инструмент и откройте разбор, чтобы оценить ситуацию и пересмотреть план лечения.',target:'#finish-button'}:manualStep||steps()?.[index];}
 function render(){const s=state();const step=current();if(!step)return;document.getElementById('coach-title').textContent=step.title;document.getElementById('coach-copy').textContent=step.text;document.getElementById('coach-progress').textContent=manualStep&&!s.critical?'Ориентир':s.critical?'Разбор ситуации':`${index+1} / ${steps().length}`;document.getElementById('coach-prev').disabled=!!manualStep||index===0;document.getElementById('coach-next').disabled=s.critical;document.getElementById('coach-next').textContent=manualStep?'Продолжить':index===steps().length-1?'Сначала':'Далее';annotate(document.getElementById('coach-copy'));}
 function stepBy(delta){if(manualStep){manualStep=null;render();update();return;}const list=steps();index=(index+delta+list.length)%list.length;clear();render();const target=current().target;if(target.startsWith('#')||target.startsWith('['))document.querySelector(target)?.scrollIntoView({block:'center',behavior:'smooth'});update();}
 document.getElementById('coach-prev').onclick=()=>stepBy(-1);document.getElementById('coach-next').onclick=()=>stepBy(1);document.getElementById('coach-dismiss').onclick=()=>onToggle(false);
 toggle.onclick=()=>onToggle(!state().enabled);
 function update(){const s=state();if(s.stage!==previousStage||s.critical!==previousCritical||!!s.early!==previousEarly){previousEarly=!!s.early;manualStep=null;previousStage=s.stage;previousCritical=s.critical;index=0;clear();render();}
  const earlyText=JSON.stringify(s.early);if(earlyText!==previousEarlyText){previousEarlyText=earlyText;index=Math.min(index,steps().length-1);render();}
  const visible=s.ready&&s.enabled&&s.mode==='learn'&&s.view==='tooth'&&!document.querySelector('dialog[open]')&&!['tilt','yaw'].includes(document.activeElement?.id);card.hidden=!visible;svg.style.display=visible?'':'none';toggle.setAttribute('aria-pressed',String(s.enabled&&s.mode==='learn'));toggle.classList.toggle('active',s.enabled&&s.mode==='learn');if(!visible){clear();return;}
  const step=current();if(!step)return;let target;
  if(step.target.startsWith('#')||step.target.startsWith('[')){const el=document.querySelector(step.target);if(el!==lastTarget){clear();lastTarget=el;el?.classList.add('guide-target');}if(el){const r=el.getBoundingClientRect();target={x:r.left+r.width/2,y:r.top+r.height/2,visible:r.top>=0&&r.bottom<=innerHeight};}}
  else{clear();target=locate(step.target);}
  const path=svg.querySelector('#guide-path'),point=svg.querySelector('#guide-point');if(!target?.visible){path.style.display='none';point.style.display='none';return;}path.style.display='';point.style.display='';
  svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);const r=card.getBoundingClientRect();const sx=target.x<r.left?r.left+5:r.right-5,sy=r.bottom-18;const dx=target.x-sx,dy=target.y-sy;const len=Math.hypot(dx,dy)||1,ex=target.x-dx/len*12,ey=target.y-dy/len*12;
  path.setAttribute('d',`M ${sx} ${sy} Q ${sx+dx*.25} ${sy+dy*.7-25} ${ex} ${ey}`);point.setAttribute('cx',target.x);point.setAttribute('cy',target.y);
 }
 return {update,showTarget(step){update();manualStep=step;clear();render();update();},goTo(next){manualStep=null;update();index=Math.max(0,Math.min(steps().length-1,next));clear();render();update();},reset(){previousStage=-1;index=0;update();}};
}
