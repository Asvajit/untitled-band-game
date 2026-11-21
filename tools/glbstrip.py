# Keep only base-colour and emissive textures (the game uses flat toon shading), repack the GLB.
import sys, json, struct
src, dst = sys.argv[1], sys.argv[2]
d=open(src,'rb').read(); off=12; chunks=[]
while off<len(d):
    n,t=struct.unpack('<I4s',d[off:off+8]); chunks.append(d[off+8:off+8+n]); off+=8+n
j=json.loads(chunks[0]); bin_=chunks[1]
keepTex=set()
for m in j['materials']:
    pbr=m.get('pbrMetallicRoughness',{})
    for k in list(pbr):
        if k.endswith('Texture') and k!='baseColorTexture': del pbr[k]
    for k in ['normalTexture','occlusionTexture']: m.pop(k,None)
    m.pop('extensions',None)
    if 'baseColorTexture' in pbr: keepTex.add(pbr['baseColorTexture']['index'])
    if 'emissiveTexture' in m: keepTex.add(m['emissiveTexture']['index'])
j.pop('extensionsUsed',None); j.pop('extensionsRequired',None)
texMap={}; imgMap={}; newTex=[]; newImg=[]
for ti in sorted(keepTex):
    t=dict(j['textures'][ti]); si=t['source']
    if si not in imgMap: imgMap[si]=len(newImg); newImg.append(j['images'][si])
    t['source']=imgMap[si]; texMap[ti]=len(newTex); newTex.append(t)
for m in j['materials']:
    pbr=m.get('pbrMetallicRoughness',{})
    if 'baseColorTexture' in pbr: pbr['baseColorTexture']['index']=texMap[pbr['baseColorTexture']['index']]
    if 'emissiveTexture' in m: m['emissiveTexture']['index']=texMap[m['emissiveTexture']['index']]
j['textures']=newTex; j['images']=newImg
used=set(a['bufferView'] for a in j['accessors'] if 'bufferView' in a)|set(i['bufferView'] for i in newImg)
bvMap={}; newBV=[]; out=bytearray()
for i,bv in enumerate(j['bufferViews']):
    if i not in used: continue
    while len(out)%4: out.append(0)
    data=bin_[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    nb=dict(bv); nb['byteOffset']=len(out); nb['buffer']=0; out+=data; bvMap[i]=len(newBV); newBV.append(nb)
for a in j['accessors']:
    if 'bufferView' in a: a['bufferView']=bvMap[a['bufferView']]
for im in newImg: im['bufferView']=bvMap[im['bufferView']]
j['bufferViews']=newBV
while len(out)%4: out.append(0)
j['buffers']=[{'byteLength':len(out)}]
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
total=12+8+len(js)+8+len(out)
open(dst,'wb').write(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(out),b'BIN\x00')+bytes(out))
print('wrote',dst,total,'bytes; images',[(i.get('mimeType'),newBV[i['bufferView']]['byteLength']) for i in newImg])
