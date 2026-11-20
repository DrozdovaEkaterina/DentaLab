import {surfaceNets} from './mesher.js';
self.onmessage=({data:{volume,meta,request}})=>{
 const mesh=surfaceNets(volume,meta);
 self.postMessage({mesh,request},[mesh.positions.buffer,mesh.colors.buffer,mesh.indices.buffer]);
};
