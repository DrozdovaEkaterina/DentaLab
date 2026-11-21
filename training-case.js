import {ToothVolume} from './volume.js?v=0.9.1';
// New attempts use the shallowest half of the original lesion. Existing attempts
// retain their original baseline, so deltas, tissue totals and reports stay valid.
export function trainingCase(meta,base,save){
 if(save&&save.modelVersion!==3){const volume=new ToothVolume(meta,base);const extra=volume.restore(save);return {volume,extra};}
 const data=new Uint8Array(base),[nx,ny,nz]=meta.size,lesion=[];
 for(let i=0;i<data.length;i++)if(data[i]===3)lesion.push(i);
 const y=i=>Math.floor(i/nx)%ny;
 lesion.sort((a,b)=>y(b)-y(a)||a-b);
 const retained=Math.ceil(lesion.length*.5);
 for(const i of lesion.slice(retained)){
  const x=i%nx,iy=y(i),z=Math.floor(i/(nx*ny));let enamel=false;
  for(const [dx,dy,dz] of [[4,0,0],[-4,0,0],[0,4,0],[0,-4,0],[0,0,4],[0,0,-4]]){const xx=x+dx,yy=iy+dy,zz=z+dz;if(xx<0||xx>=nx||yy<0||yy>=ny||zz<0||zz>=nz||!base[xx+nx*(yy+ny*zz)]){enamel=true;break;}}
  data[i]=enamel?1:2;
 }
 const counts={};for(const value of data)counts[value]=(counts[value]||0)+1;
 const volume=new ToothVolume({...meta,version:3,counts,difficulty:'intro-half-lesion',originalCaries:lesion.length},data);
 const extra=save?volume.restore(save):{};return {volume,extra};
}
