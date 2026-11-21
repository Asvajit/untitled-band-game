import sys, json, struct
d=open(sys.argv[1],'rb').read()
magic,ver,length=struct.unpack('<4sII',d[:12]); off=12; chunks=[]
while off<length:
    n,t=struct.unpack('<I4s',d[off:off+8]); chunks.append((t,d[off+8:off+8+n])); off+=8+n
j=json.loads(chunks[0][1])
print('asset',j.get('asset')); print('extensions',j.get('extensionsUsed'))
print('scenes',len(j.get('scenes',[])),'nodes',len(j['nodes']),'meshes',len(j['meshes']),'materials',len(j.get('materials',[])),'textures',len(j.get('textures',[])),'images',[(i.get('mimeType'),j['bufferViews'][i['bufferView']]['byteLength']) for i in j.get('images',[])],'anims',len(j.get('animations',[])))
acc=j['accessors']
tri=0
for mi,m in enumerate(j['meshes']):
    for p in m['primitives']:
        a=acc[p['attributes']['POSITION']]; n=acc[p['indices']]['count']//3 if 'indices' in p else a['count']//3; tri+=n
        print('mesh',mi,m.get('name'),'tris',n,'min',[round(x,2) for x in a['min']],'max',[round(x,2) for x in a['max']],'mat',j['materials'][p['material']].get('name') if 'material' in p else None, list(p['attributes']))
print('total tris',tri)
for i,n in enumerate(j['nodes']): print('node',i,n.get('name'),{k:v for k,v in n.items() if k in('mesh','children','translation','rotation','scale','matrix')})
for m in j.get('materials',[]): print('mat',json.dumps(m)[:300])
