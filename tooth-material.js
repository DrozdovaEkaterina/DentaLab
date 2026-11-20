import * as THREE from 'three';
// Procedural tissue appearance in tooth-local millimetres. These parameters affect
// rendering only; the underlying clinical/volume data remain unchanged.
export function makeToothMaterial(){
 const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.28,metalness:0,clearcoat:.26,clearcoatRoughness:.22,ior:1.54,specularIntensity:.65,envMapIntensity:.7,side:THREE.DoubleSide});
 material.customProgramCacheKey=()=> 'dental-tissues-2';
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute float tissue;
varying float vDentalTissue;
varying vec3 vDentalPosition;`).replace('#include <begin_vertex>',`#include <begin_vertex>
vDentalTissue=tissue;
vDentalPosition=position;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying float vDentalTissue;
varying vec3 vDentalPosition;
float dentalHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float dentalNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(dentalHash(i),dentalHash(i+vec3(1,0,0)),f.x),mix(dentalHash(i+vec3(0,1,0)),dentalHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(dentalHash(i+vec3(0,0,1)),dentalHash(i+vec3(1,0,1)),f.x),mix(dentalHash(i+vec3(0,1,1)),dentalHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float dentalLayer(float id){return 1.0-smoothstep(0.15,0.7,abs(vDentalTissue-id));}
`).replace('#include <color_fragment>',`#include <color_fragment>
vec3 dp=vDentalPosition;
float enamel=dentalLayer(1.0),dentin=dentalLayer(2.0),caries=dentalLayer(3.0),pulp=dentalLayer(4.0);
float root=1.0-smoothstep(-1.4,0.8,dp.y);
float cervical=exp(-pow((dp.y+0.2)*0.7,2.0));
float cloud=dentalNoise(dp*1.6);
float fine=dentalNoise(dp*34.0);
float striae=sin(dp.y*28.0+dentalNoise(dp*4.0)*1.2)*0.5+0.5;
vec3 enamelShade=mix(vec3(0.55,0.43,0.27),vec3(0.74,0.70,0.59),smoothstep(-0.3,4.7,dp.y));
enamelShade*=0.97+cloud*0.045+striae*0.012;
vec3 dentinShade=vec3(0.56,0.39,0.19)*(0.94+cloud*0.09);
vec3 cementumShade=mix(vec3(0.55,0.43,0.27),vec3(0.64,0.52,0.35),cloud);
float rootLines=pow(sin(atan(dp.z,dp.x)*43.0+dentalNoise(dp*1.3)*1.8)*0.5+0.5,10.0);
cementumShade*=1.0-rootLines*0.035;
vec3 nativeShade=mix(enamelShade,dentinShade,dentin);
nativeShade=mix(nativeShade,cementumShade,root*(enamel+dentin));
nativeShade*=1.0-cervical*0.07;
vec3 lesionShade=mix(vec3(0.018,0.006,0.002),vec3(0.14,0.061,0.015),cloud)*(0.86+fine*0.24);
vec3 pulpShade=vec3(0.39,0.018,0.025)*(0.85+cloud*0.22);
float nativeMask=clamp(enamel+dentin,0.0,1.0);
diffuseColor.rgb=mix(diffuseColor.rgb,nativeShade,nativeMask);
diffuseColor.rgb=mix(diffuseColor.rgb,lesionShade,caries);
diffuseColor.rgb=mix(diffuseColor.rgb,pulpShade,pulp);
`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.23+cloud*0.09,enamel);
roughnessFactor=mix(roughnessFactor,0.43+fine*0.08,root*nativeMask);
roughnessFactor=mix(roughnessFactor,0.66+cloud*0.14,caries);
`).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= enamel*(1.0-root)*0.95+0.03;
material.clearcoatRoughness=mix(material.clearcoatRoughness,0.7,caries);
#endif
`).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
// Subtle directional microstructure; no geometry or collision changes.
float dentalBump=(dentalNoise(vDentalPosition*45.0)-0.5)*(0.009+root*0.011+caries*0.016);
normal=normalize(normal+vec3(dentalBump,-dentalBump*0.35,dentalBump*0.7));
`);
 };
 return material;
}
