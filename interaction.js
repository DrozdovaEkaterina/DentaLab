// Automatic aiming responds to the contact position, independently for each lock.
export function followPointer(point,center,{tilt=0,yaw=0,tiltLocked=false,yawLocked=false}={}){
 const dx=point[0]-center[0],dz=point[2]-center[2],r=Math.hypot(dx,dz);
 return {tilt:tiltLocked?tilt:Math.min(60,Math.round(r*5.5)),yaw:yawLocked||r<.18?yaw:Math.round(Math.atan2(-dx,-dz)*180/Math.PI)};
}
export function isolationContour(data,meta,y=-.65,segments=128){
 const {origin,step,size:[nx,ny,nz]}=meta;const iy=Math.max(0,Math.min(ny-1,Math.round((y-origin[1])/step)));const points=[];
 for(let n=0;n<segments;n++){
  const a=n/segments*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let radius=0;
  for(let r=0;r<12;r+=step*.25){const x=Math.round((r*dx-origin[0])/step),z=Math.round((r*dz-origin[2])/step);if(x>=0&&x<nx&&z>=0&&z<nz&&data[x+nx*(iy+ny*z)])radius=r;}
  points.push([dx*Math.max(.1,radius-.06),y,dz*Math.max(.1,radius-.06)]);
 }
 // Smooth sampling stair steps, retaining a slight overlap for a continuous seal.
 return points.map((p,i)=>{const a=points[(i+segments-1)%segments],b=points[(i+1)%segments];return [p[0]*.6+(a[0]+b[0])*.2,y,p[2]*.6+(a[2]+b[2])*.2];});
}
