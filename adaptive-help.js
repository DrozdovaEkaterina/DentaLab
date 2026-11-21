import {planEarlyExcavation} from './early-coach.js?v=0.11.0';
export class AttemptCoach{
 constructor(){this.failures=0;this.streak=0;this.hints=0;}
 record(progress){if(progress){this.streak=0;return false;}this.failures++;this.streak++;if((this.hints===0&&this.failures>=5)||(this.hints>0&&this.streak>=2)){this.hints++;this.streak=0;return true;}return false;}
}
// Explicit beginner assistance: restrict these passes to lesion voxels only.
// Manual drilling remains governed by the ordinary tool geometry.
export function guidedPass(volume,steps=12){let removed=0,last=null;for(let n=0;n<steps;n++){const plan=planEarlyExcavation(volume,.35,{beyondIntro:true});if(plan?.status!=='work')break;last=plan;const before=volume.data.slice(),metrics={...volume.metrics};volume.apply(plan.point,[0,-1,0],{tool:'round',radius:.35,powered:true});let count=0;for(let i=0;i<before.length;i++){if(before[i]!==3&&volume.data[i]!==before[i])volume.data[i]=before[i];if(before[i]===3&&volume.data[i]===0)count++;}volume.metrics={...metrics,cariesRemoved:metrics.cariesRemoved+count};removed+=count;if(!count)break;}
 return {removed,last,next:planEarlyExcavation(volume,.35,{beyondIntro:true})};}
export function guidedFill(volume){let added=0;for(let i=0;i<volume.data.length;i++)if(volume.data[i]===0&&volume.base[i]>0&&volume.base[i]!==4){volume.data[i]=5;added++;}volume.metrics.compositeAdded+=added;return added;}
