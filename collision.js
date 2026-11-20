const RAD=Math.PI/180;
export function toolAxis(tilt,yaw){return [Math.sin(tilt*RAD)*Math.sin(yaw*RAD),-Math.cos(tilt*RAD),Math.sin(tilt*RAD)*Math.cos(yaw*RAD)];}
// Tests the non-cutting shaft/handle against the current voxel boundary. The working
// head may contact native tissues; rotating a head into pulp is counted separately.
export function toolCollisionScore(volume,point,tilt,yaw,{tool='round',radius=.65}={}){
 if(!['round','fissure','polish','composite','light'].includes(tool))return 0;
 const {origin,step,size:[nx,ny,nz]}=volume.meta,data=volume.data,up=toolAxis(tilt,yaw).map(v=>-v),seen=new Set();let score=0;
 function sample(center,r,pulpOnly=false){const pad=r+step*.4;const lo=center.map((v,k)=>Math.max(0,Math.floor((v-pad-origin[k])/step))),hi=center.map((v,k)=>Math.min([nx,ny,nz][k]-1,Math.ceil((v+pad-origin[k])/step)));
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){const i=x+nx*(y+ny*z),v=data[i];if(!v||seen.has(i)||(pulpOnly&&v!==4))continue;const d=(origin[0]+x*step-center[0])**2+(origin[1]+y*step-center[1])**2+(origin[2]+z*step-center[2])**2;if(d<pad*pad){seen.add(i);score+=v===4?8:1;}}
 }
 const headLength=tool==='fissure'?1.8:0;for(let t=0;t<=headLength;t+=.3)sample(point.map((v,k)=>v+up[k]*t),radius,true);
 for(let t=Math.max(radius+.3,headLength+.3);t<=10.4;t+=.45){const r=t<5.6?.17:.5+(t-5.6)*.065;sample(point.map((v,k)=>v+up[k]*t),r);}
 return score;
}
const wrap=d=>((d+180)%360+360)%360-180;
export function constrainToolAngles(volume,point,previous,desired,options={}){
 const dx=wrap(desired.tilt-previous.tilt),dy=wrap(desired.yaw-previous.yaw),n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/2));
 const anchor=a=>options.positionForAngles?options.positionForAngles(a):point;let accepted={...previous},baseline=toolCollisionScore(volume,anchor(previous),previous.tilt,previous.yaw,options);
 for(let i=1;i<=n;i++){const next=i===n?{...desired}:{tilt:wrap(previous.tilt+dx*i/n),yaw:wrap(previous.yaw+dy*i/n)};const score=toolCollisionScore(volume,anchor(next),next.tilt,next.yaw,options);
  if(score>0&&(baseline===0||score>baseline))return {...accepted,blocked:true};accepted=next;baseline=score;
 }
 return {...accepted,blocked:false};
}
export function pulpClearance(volume,point,radius=.65,axis=[0,-1,0],headLength=0){
 if(!point)return Infinity;
 let points=volume._pulpPoints;if(!points){points=[];const {size:[nx,ny],origin,step}=volume.meta;for(let i=0;i<volume.base.length;i++)if(volume.base[i]===4)points.push([origin[0]+i%nx*step,origin[1]+Math.floor(i/nx)%ny*step,origin[2]+Math.floor(i/(nx*ny))*step]);volume._pulpPoints=points;}
 let nearest=Infinity;for(const p of points){const d=p.map((v,k)=>v-point[k]);const t=Math.max(0,Math.min(headLength,-d.reduce((s,v,k)=>s+v*axis[k],0)));const distance=Math.hypot(...d.map((v,k)=>v+axis[k]*t));nearest=Math.min(nearest,distance);}
 return nearest-radius;
}
