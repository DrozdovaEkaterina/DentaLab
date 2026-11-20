export const TISSUE = Object.freeze({ AIR: 0, ENAMEL: 1, DENTIN: 2, CARIES: 3, PULP: 4, COMPOSITE: 5, CURED: 6 });
export const COLORS = [[0,0,0],[.94,.91,.79],[.78,.59,.32],[.07,.025,.009],[.70,.07,.10],[.48,.76,.79],[.95,.94,.87]];
export class ToothVolume {
  constructor(meta, base) {
    this.meta=meta; this.base=new Uint8Array(base); this.data=this.base.slice();
    this.initialCaries=this.base.reduce((n,v)=>n+(v===3),0); this.resetMetrics();
  }
  resetMetrics(){this.metrics={healthyRemoved:0,cariesRemoved:0,pulpRemoved:0,compositeAdded:0,overfill:0,drySeconds:0,activeSeconds:0};this.exposures=0;}
  index(x,y,z){const [nx,ny]=this.meta.size; return x+nx*(y+ny*z);}
  point(x,y,z){return this.meta.origin.map((a,i)=>a+[x,y,z][i]*this.meta.step);}
  reset(){this.data.set(this.base);this.resetMetrics();}
  // A swept working head, in model millimetres. Intermediate samples cannot tunnel.
  stroke(from,to,axis,options){
    const dist=Math.hypot(...to.map((v,i)=>v-from[i]));const count=Math.max(1,Math.ceil(dist/(this.meta.step*.45)));
    // Refuse discontinuous pointer jumps rather than drilling through the tooth.
    if(dist>20)return 0;
    let changed=0;
    for(let k=0;k<=count;k++)changed+=this.apply(to.map((v,i)=>from[i]+(v-from[i])*k/count),axis,{...options,dt:0});
    if(changed&&options.dt){this.metrics.activeSeconds+=options.dt;if(options.cooling===false&&['round','fissure'].includes(options.tool))this.metrics.drySeconds+=options.dt;}
    return changed;
  }
  apply(center,axis,{tool='round',radius=.65,powered=false,cooling=true,dt=0}={}){
    if(!powered || !['round','fissure','composite','polish'].includes(tool))return 0;
    if(!center.every(Number.isFinite)||!axis.every(Number.isFinite))return 0;
    const al=Math.hypot(...axis);if(al<.9||al>1.1)return 0;
    const {size,origin,step}=this.meta;const length=tool==='fissure'?1.8:0;const reach=radius+length;
    const low=center.map((v,i)=>Math.max(0,Math.floor((v-reach-origin[i])/step)));
    const high=center.map((v,i)=>Math.min(size[i]-1,Math.ceil((v+reach-origin[i])/step)));
    let changed=0;
    for(let z=low[2];z<=high[2];z++)for(let y=low[1];y<=high[1];y++)for(let x=low[0];x<=high[0];x++){
      const i=this.index(x,y,z),v=this.data[i];const p=[x,y,z].map((q,k)=>origin[k]+q*step-center[k]);
      const axial=p.reduce((s,q,k)=>s+q*axis[k],0);const sq=p.reduce((s,q)=>s+q*q,0);
      // Cylinder extends proximally from the tip; the round head is spherical.
      const hit=length?axial<=0&&axial>=-length&&sq-axial*axial<=radius*radius:sq<=radius*radius;
      if(!hit)continue;
      if(tool==='composite'){
        if(v===0 && this.base[i]>0 && this.base[i]!==4){this.data[i]=5;this.metrics.compositeAdded++;changed++;}
      }else if(tool==='polish'){
        // Refinement is restricted to restorative material.
        if(v===5||v===6){this.data[i]=0;changed++;}
      }else if(v){
        if(v===3)this.metrics.cariesRemoved++;
        else if(v===4){this.metrics.pulpRemoved++;this.exposures++;}
        else if(v===1||v===2)this.metrics.healthyRemoved++;
        this.data[i]=0;changed++;
      }
    }
    if(changed&&dt){this.metrics.activeSeconds+=dt;if(!cooling&&['round','fissure'].includes(tool))this.metrics.drySeconds+=dt;}
    return changed;
  }
  cure(){let n=0;for(let i=0;i<this.data.length;i++)if(this.data[i]===5){this.data[i]=6;n++;}return n;}
  stats(){
    let caries=0,filled=0,uncured=0,missing=0,exposed=0;const {size:[nx,ny,nz]}=this.meta;
    for(let i=0;i<this.data.length;i++){
      const v=this.data[i];if(v===3)caries++;if(v===5)uncured++;if(v===5||v===6)filled++;
      if(this.base[i]&&this.base[i]!==4&&!v)missing++;
      if(v===4 && this.meta.origin[1]+Math.floor(i/nx)%ny*this.meta.step>-.5){const x=i%nx,y=Math.floor(i/nx)%ny,z=Math.floor(i/(nx*ny));
        if(x>0&&x<nx-1&&y>0&&y<ny-1&&z>0&&z<nz-1&&[i-1,i+1,i-nx,i+nx,i-nx*ny,i+nx*ny].some(j=>this.base[j]>0&&!this.data[j]))exposed++;
      }
    }
    const mm3=this.meta.step**3;
    return {caries,remainingPercent:100*caries/this.initialCaries,filled,uncured,missing,exposed,
      healthyVolume:this.metrics.healthyRemoved*mm3,removedVolume:this.metrics.cariesRemoved*mm3,
      pulpVolume:this.metrics.pulpRemoved*mm3,cavityVolume:missing*mm3,fillVolume:filled*mm3,critical:this.metrics.pulpRemoved>0||exposed>0};
  }
  serialize(extra={}){
    const changes=[];for(let i=0;i<this.data.length;i++)if(this.data[i]!==this.base[i])changes.push([i,this.data[i]]);
    return {schema:1,modelVersion:this.meta.version,grid:this.meta.size,step:this.meta.step,changes,metrics:{...this.metrics},extra,savedAt:new Date().toISOString()};
  }
  restore(save){
    if(save?.schema!==1||save.modelVersion!==this.meta.version||JSON.stringify(save.grid)!==JSON.stringify(this.meta.size)||save.step!==this.meta.step||!Array.isArray(save.changes)||save.changes.length>this.data.length)throw Error('Файл относится к другой версии модели.');
    const next=this.base.slice();const seen=new Set();
    for(const pair of save.changes){if(!Array.isArray(pair)||pair.length!==2)throw Error('Повреждённый файл.');const [i,v]=pair;
      if(!Number.isInteger(i)||i<0||i>=next.length||!Number.isInteger(v)||v<0||v>6||seen.has(i))throw Error('Недопустимые данные модели.');
      // Imported edits can remove tissue or restore an existing cavity, never change anatomy.
      if(v!==0&&v!==this.base[i]&&!(this.base[i]!==0&&this.base[i]!==4&&(v===5||v===6)))throw Error('Недопустимая замена ткани.');
      seen.add(i);next[i]=v;
    }
    for(const k of Object.keys(this.metrics))if(!Number.isFinite(save.metrics?.[k])||save.metrics[k]<0)throw Error('Повреждена статистика.');
    this.data.set(next);this.metrics={...save.metrics};return save.extra||{};
  }
}
