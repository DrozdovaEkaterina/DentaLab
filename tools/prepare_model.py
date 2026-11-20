"""Reproducibly split and voxelize the supplied CC-BY mouth. No third-party dependencies."""
import json,struct,collections,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
raw=(ROOT/'assets/human_mouth_detailed.glb').read_bytes()
n=struct.unpack_from('<I',raw,12)[0]; doc=json.loads(raw[20:20+n]); binary=raw[28+n:]
p=doc['meshes'][1]['primitives'][0]
def read(aid):
 a=doc['accessors'][aid];v=doc['bufferViews'][a['bufferView']];fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]; k={'VEC3':3,'SCALAR':1}[a['type']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',k*struct.calcsize(fmt))
 return [struct.unpack_from('<'+fmt*k,binary,offset+i*stride) for i in range(a['count'])]
pts=read(p['attributes']['POSITION']);indices=[x[0] for x in read(p['indices'])];parent=list(range(len(pts)))
def root(a):
 while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
 return a
def union(a,b):parent[root(a)]=root(b)
seen={}
for i,v in enumerate(pts):
 key=tuple(round(x,7) for x in v)
 if key in seen:union(i,seen[key])
 else:seen[key]=i
for i in range(0,len(indices),3):union(indices[i],indices[i+1]);union(indices[i],indices[i+2])
selected=root(6592); component=[i for i in range(len(pts)) if root(i)==selected];cset=set(component)
bounds=[(min(pts[i][k] for i in component),max(pts[i][k] for i in component)) for k in range(3)]
scale=850.;cx=sum(bounds[0])/2;cz=sum(bounds[2])/2;top=bounds[1][1]
vertices=[((pts[i][0]-cx)*scale,(pts[i][1]-top)*scale+5.5,(pts[i][2]-cz)*scale) for i in component]
remap={i:j for j,i in enumerate(component)}
faces=[tuple(remap[v] for v in indices[i:i+3]) for i in range(0,len(indices),3) if indices[i] in cset]
lo=[min(v[k] for v in vertices)-.5 for k in range(3)];hi=[max(v[k] for v in vertices)+.5 for k in range(3)];step=.25
size=[math.ceil((hi[k]-lo[k])/step)+1 for k in range(3)];nx,ny,nz=size
columns=collections.defaultdict(list)
for face in faces:
 a,b,c=[vertices[i] for i in face];den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
 if abs(den)<1e-12:continue
 for iz in range(max(0,math.ceil((min(a[2],b[2],c[2])-lo[2])/step)),min(nz-1,math.floor((max(a[2],b[2],c[2])-lo[2])/step))+1):
  z=lo[2]+iz*step
  for ix in range(max(0,math.ceil((min(a[0],b[0],c[0])-lo[0])/step)),min(nx-1,math.floor((max(a[0],b[0],c[0])-lo[0])/step))+1):
   x=lo[0]+ix*step;u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
   if u>=-1e-7 and v>=-1e-7 and u+v<=1+1e-7:columns[ix,iz].append(u*a[1]+v*b[1]+(1-u-v)*c[1])
base=bytearray(nx*ny*nz);tops={}
for (ix,iz),ys in columns.items():
 ys=sorted(set(round(v,5) for v in ys));tops[ix,iz]=max(ys)
 for iy in range(ny):
  y=lo[1]+iy*step
  if sum(q>y for q in ys)%2:base[ix+nx*(iy+ny*iz)]=2
# Preserve the supplied crown and reconstruct two smoothly tapering roots.
# The source has a fused coarse root stump; no patient-specific root anatomy is implied.
for iz in range(nz):
 for iy in range(ny):
  y=lo[1]+iy*step
  if y>=-.7:continue
  t=(-y-.7)/11.0
  for ix in range(nx):
   x,z=lo[0]+ix*step,lo[2]+iz*step
   solid=False
   collar=max(0,1-(-y-.7)/1.9)
   if collar>0 and (x/(4.2*collar**.7))**2+(z/(6.0*collar**.7))**2<1:solid=True
   if 0<=t<1:
    for sign in (-1,1):
     rz=2.65*(1-t)**.65+.10;rx=2.7*(1-t)**.75+.12
     root_z=sign*(2.3+2.2*t+.3*math.sin(math.pi*t));root_x=sign*(.25+.5*t)
     if ((x-root_x)/rx)**2+((z-root_z)/rz)**2<1:solid=True
   base[ix+nx*(iy+ny*iz)]=2 if solid else 0
# Morphological surface distance: a teaching reconstruction, not patient anatomy.
for iz in range(1,nz-1):
 for iy in range(1,ny-1):
  for ix in range(1,nx-1):
   i=ix+nx*(iy+ny*iz)
   if not base[i]:continue
   x,y,z=lo[0]+ix*step,lo[1]+iy*step,lo[2]+iz*step
   if y>-.6:
    offsets=[(4,0,0),(-4,0,0),(0,4,0),(0,-4,0),(0,0,4),(0,0,-4)]
    for dx,dy,dz in offsets:
     xx,yy,zz=ix+dx,iy+dy,iz+dz
     if not (0<=xx<nx and 0<=yy<ny and 0<=zz<nz) or not base[xx+nx*(yy+ny*zz)]:base[i]=1;break
   pulp=y>=-.7 and (x/1.65)**2+((y+1.1)/3.7)**2+(z/2.1)**2<1
   # Root canals are schematic and deliberately labelled as reconstructed.
   canals=False
   if y<-.7:
    t=max(0,min(.999,(-y-.7)/11.0));cr=.32*(1-t)**.5+.08
    for sign in (-1,1):
     root_z=sign*(2.3+2.2*t+.3*math.sin(math.pi*t));root_x=sign*(.25+.5*t)
     if ((x-root_x)/cr)**2+((z-root_z)/cr)**2<1:canals=True
   if pulp or canals:base[i]=4
central=[h for (ix,iz),h in tops.items() if abs(lo[0]+ix*step)<.65 and abs(lo[2]+iz*step)<.65]
ctop=sum(central)/len(central);cy=ctop-1.0
for iz in range(nz):
 for iy in range(ny):
  for ix in range(nx):
   i=ix+nx*(iy+ny*iz)
   if base[i] not in (1,2):continue
   x,y,z=lo[0]+ix*step,lo[1]+iy*step,lo[2]+iz*step
   lesion=((x+.15)/1.8)**2+((y-cy)/1.9)**2+(z/1.65)**2<1
   neck=(x+.15)**2+z*z<.7**2 and y>cy and y<ctop+1.5
   if lesion or neck:base[i]=3
meta={'version':2,'size':size,'origin':lo,'step':step,'top':ctop,'lesionCenter':[-.15,cy,0],'sourceComponent':6592,'sourceScale':scale,'sourceCenter':[cx,top,cz],'units':'mm, approximate normalized scale','anatomy':'Reconstructed teaching layers; not a scan of internal tissues','counts':dict(collections.Counter(base))}
(ROOT/'assets/tooth-volume.json').write_text(json.dumps(meta,indent=2));(ROOT/'assets/tooth-volume.bin').write_bytes(base)
(ROOT/'assets/tooth-reference.json').write_text(json.dumps({'vertices':vertices,'faces':faces,'sourceVertices':component}))
print(json.dumps(meta,indent=2))
