import {surfaceNets} from './mesher.js?v=0.8.0';
self.onmessage=({data:{volume,meta,request}})=>{
 const mesh=surfaceNets(volume,meta);
 self.postMessage({mesh,request},[mesh.positions.buffer,mesh.colors.buffer,mesh.tissues.buffer,mesh.indices.buffer]);
};
