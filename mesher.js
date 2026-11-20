import {COLORS} from './volume.js';
// Surface nets: one averaged intersection per boundary cell, then shared quads.
// The source is a volume; all tool edits regenerate its actual boundary.
export function surfaceNets(data,meta,only=0){
 const [nx,ny,nz]=meta.size,{origin,step}=meta;const cells=new Int32Array(data.length);cells.fill(-1);
 const positions=[],colors=[],indices=[];const offsets=[0,1,nx,nx+1,nx*ny,nx*ny+1,nx*ny+nx,nx*ny+nx+1];
 const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
 const solid=i=>only?data[i]===only:data[i]>0;
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const i=x+nx*(y+ny*z);let mask=0;for(let c=0;c<8;c++)if(solid(i+offsets[c]))mask|=1<<c;
  if(mask===0||mask===255)continue;
  let ax=0,ay=0,az=0,n=0;const votes=new Uint8Array(7);
  for(let c=0;c<8;c++)if(mask&(1<<c))votes[data[i+offsets[c]]]++;
  for(const [a,b] of edges)if(((mask>>a)&1)!==((mask>>b)&1)){
   ax+=((a&1)+(b&1))*.5;ay+=(((a>>1)&1)+((b>>1)&1))*.5;az+=(((a>>2)&1)+((b>>2)&1))*.5;n++;
  }
  cells[i]=positions.length/3;positions.push(origin[0]+(x+ax/n)*step,origin[1]+(y+ay/n)*step,origin[2]+(z+az/n)*step);
  let tissue=1;for(let k=2;k<7;k++)if(votes[k]>votes[tissue])tissue=k;
  colors.push(...COLORS[tissue]);
 }
 function quad(ids,flip){if(ids.some(i=>i<0))return;const [a,b,c,d]=ids;if(flip)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d);}
 for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
  const i=x+nx*(y+ny*z),s=solid(i);
  if(s!==solid(i+1))quad([cells[i-nx-nx*ny],cells[i-nx*ny],cells[i],cells[i-nx]],!s);
  if(s!==solid(i+nx))quad([cells[i-1-nx*ny],cells[i-1],cells[i],cells[i-nx*ny]],!s);
  if(s!==solid(i+nx*ny))quad([cells[i-1-nx],cells[i-nx],cells[i],cells[i-1]],!s);
 }
 return {positions:new Float32Array(positions),colors:new Float32Array(colors),indices:new Uint32Array(indices)};
}
