import asyncio, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':800,'height':600})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        url = await pg.evaluate("""(()=>{
          const w=__dbg.world, PX=1.0; // pixels per metre
          const M={l:90,r:330,t:110,b:70};
          let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9; for(let i=0;i<=w.N;i++){minX=Math.min(minX,w.rx[i]);maxX=Math.max(maxX,w.rx[i]);minZ=Math.min(minZ,w.rz[i]);maxZ=Math.max(maxZ,w.rz[i]);}
          minX=Math.floor((minX-230)/100)*100; maxX=Math.ceil((maxX+230)/100)*100; minZ=Math.floor((minZ-120)/100)*100; maxZ=Math.ceil((maxZ+120)/100)*100;
          const W=(maxX-minX)*PX, H=(maxZ-minZ)*PX;
          const c=document.createElement('canvas'); c.width=W+M.l+M.r; c.height=H+M.t+M.b; const g=c.getContext('2d');
          // north up; east is to the RIGHT (game +x is west, matching the in-game view)
          const X=(x)=>M.l+(maxX-x)*PX, Y=(z)=>M.t+(maxZ-z)*PX;
          g.fillStyle='#14121a'; g.fillRect(0,0,c.width,c.height);
          // terrain: biome colour shaded by height, only where the world exists
          const cs=4, img=g.createImageData(Math.ceil(W/cs/PX*PX), 1);
          for(let z=maxZ; z>minZ; z-=cs){ for(let x=maxX; x>minX; x-=cs){
            const n=w.fastNearest(x,z); if(n.d>300) continue; if(w.sampleTerrain(x,z)===0) continue;
            const bio=w.biome(n.s), h=w.sampleTerrain(x,z), base=w.roadYAt(n.s);
            let r=0,gg=0,bb=0; const add=(c,k)=>{r+=c[0]*k;gg+=c[1]*k;bb+=c[2]*k;};
            add([104,150,72],bio.c); add([200,124,72],bio.d); add([122,120,128],bio.u);
            const sh=Math.max(0.5,Math.min(1.45,1+(h-base)*0.03))*(0.94+0.06*Math.sin(x*0.05)*Math.sin(z*0.05));
            if(w.riverDist(x,z)<6){r=79;gg=156;bb=196;}
            g.fillStyle=`rgb(${r*sh|0},${gg*sh|0},${bb*sh|0})`; g.fillRect(X(x),Y(z),cs*PX+0.5,cs*PX+0.5);
          }}
          // edge-of-world fade
          // grid
          g.lineWidth=1; g.font='13px monospace'; g.textAlign='center';
          for(let x=minX;x<=maxX;x+=100){ g.strokeStyle=x%500===0?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(X(x),M.t); g.lineTo(X(x),M.t+H); g.stroke(); if(x%200===0){g.fillStyle='#cfc8d8'; g.fillText(`${x}`,X(x),M.t+H+18);} }
          g.textAlign='right';
          for(let z=minZ;z<=maxZ;z+=100){ g.strokeStyle=z%500===0?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(M.l,Y(z)); g.lineTo(M.l+W,Y(z)); g.stroke(); if(z%500===0){g.fillStyle='#cfc8d8'; g.fillText(`${z} m`,M.l-8,Y(z)+4);} }
          // road (true width) + centre line
          g.lineCap='round'; g.lineJoin='round';
          const path=()=>{g.beginPath(); for(let i=0;i<=w.N;i++){ i?g.lineTo(X(w.rx[i]),Y(w.rz[i])):g.moveTo(X(w.rx[i]),Y(w.rz[i])); }};
          path(); g.strokeStyle='#1d1a22'; g.lineWidth=Math.max(3,9.2*PX+2); g.stroke();
          path(); g.strokeStyle='#4a4652'; g.lineWidth=Math.max(2,9.2*PX); g.stroke();
          g.setLineDash([6,6]); path(); g.strokeStyle='#e8b13a'; g.lineWidth=1.2; g.stroke(); g.setLineDash([]);
          // distance ticks every 500 m along the road
          g.font='bold 12px monospace'; g.textAlign='left';
          for(let s=500;s<w.length;s+=500){ const p=w.roadPoint(s); g.fillStyle='#ffffff'; g.beginPath(); g.arc(X(p.x),Y(p.z),3,0,7); g.fill(); g.fillStyle='rgba(255,255,255,0.8)'; g.fillText(`${(s/1000).toFixed(1)}km`,X(p.x)+6,Y(p.z)+4); }
          // leg boundaries
          // places
          const pins=[];
          const sp=w.roadPoint(20); pins.push(['START · Hollow Creek Farm',sp.x,sp.z,'#ffd27a']);
          pins.push(['Silverthread Falls',w.falls.x,w.falls.z,'#7af0ff']);
          pins.push(['Bridge',w.fallsView.x,w.fallsView.z,'#b0a99e']);
          w.studios.forEach(st=>pins.push([st.label,st.center.x,st.center.z,'#a8ff7a']));
          pins.push(['Rest Stop',w.restCenter.x,w.restCenter.z,'#5ff3ff']);
          const vc=['#ffb347','#ff6ad5','#7af0ff'];
          w.venues.forEach((v,i)=>{ pins.push([`GIG ${i+1} · ${v.name}`,v.center.x,v.center.z,vc[i]]); pins.push(['Loading bay',v.loadingBay.x,v.loadingBay.z,'#c9c4bb']); });
          w.blockers.forEach(bk=>pins.push([`road block (${bk.kind})`,bk.g.position.x,bk.g.position.z,'#ff5a5a',true]));
          for(const [t,x,z,col,small] of pins){
            g.fillStyle=col; g.strokeStyle='#111'; g.lineWidth=2; g.beginPath(); g.arc(X(x),Y(z),small?4:7,0,7); g.fill(); g.stroke();
            g.font=small?'11px monospace':'bold 14px monospace'; g.lineWidth=4; g.strokeStyle='rgba(10,8,14,0.85)'; g.strokeText(t,X(x)+10,Y(z)+5); g.fillStyle=col; g.fillText(t,X(x)+10,Y(z)+5);
          }
          // biome labels
          const lab=(t,s,col)=>{const p=w.roadPoint(s); g.save(); g.font='bold 26px sans-serif'; g.fillStyle=col; g.globalAlpha=0.9; g.textAlign='right'; g.fillText(t,M.l+W-10, Y(p.z)); g.restore();};
          // title, scale bar, north arrow, legend (right margin)
          const R=M.l+W+24;
          g.fillStyle='#fff'; g.font='bold 22px sans-serif'; g.textAlign='left'; g.fillText('THE LOOSE WIRES — TOUR MAP',M.l,40);
          g.font='14px monospace'; g.fillStyle='#cfc8d8'; g.fillText(`Road ${(w.length/1000).toFixed(2)} km · grid 100 m (bold every 500 m) · 1 px = ${(1/PX).toFixed(1)} m`,M.l,64);
          g.fillText(`World ${(maxX-minX)} m × ${(maxZ-minZ)} m · coordinates in game metres (x, z)`,M.l,84);
          // scale bar
          let sy=M.t+10; g.fillStyle='#fff'; g.fillRect(R,sy,200*PX,6); g.fillStyle='#14121a'; g.fillRect(R+100*PX,sy+1,100*PX-1,4); g.font='12px monospace'; g.fillStyle='#fff'; g.fillText('0',R,sy+22); g.fillText('100',R+100*PX-10,sy+22); g.fillText('200 m',R+200*PX-16,sy+22);
          // north arrow
          sy+=60; g.fillStyle='#fff'; g.beginPath(); g.moveTo(R+20,sy); g.lineTo(R+30,sy+28); g.lineTo(R+20,sy+22); g.lineTo(R+10,sy+28); g.closePath(); g.fill(); g.font='bold 16px sans-serif'; g.fillText('N',R+14,sy-6);
          // legend
          sy+=60; g.font='bold 15px sans-serif'; g.fillStyle='#fff'; g.fillText('LEGS',R,sy); sy+=10;
          const legs=[['PART 1 · Van',0,w.sBar,'#68964a'],['PART 2 · RV',w.sBar,w.sNF,'#c87c48'],['PART 3 · Tour bus',w.sNF,w.length,'#7a7880']];
          g.font='13px monospace';
          for(const [t,a,bq,col] of legs){ sy+=24; g.fillStyle=col; g.fillRect(R,sy-11,16,14); g.fillStyle='#e8e2f0'; g.fillText(`${t}  ${((bq-a)/1000).toFixed(2)} km`,R+24,sy); }
          sy+=34; g.font='bold 15px sans-serif'; g.fillStyle='#fff'; g.fillText('MARKERS',R,sy);
          const lg=[['#ffd27a','Start'],['#ffb347','Gig 1 · The Rusty Nail'],['#ff6ad5','Gig 2 · Neon Falls'],['#7af0ff','Gig 3 · Megadome / falls'],['#a8ff7a','Practice studio'],['#5ff3ff','Rest stop'],['#c9c4bb','Loading bay'],['#ff5a5a','Road block'],['#4f9cc4','River']];
          g.font='13px monospace'; for(const [col,t] of lg){ sy+=22; g.fillStyle=col; g.beginPath(); g.arc(R+8,sy-4,6,0,7); g.fill(); g.fillStyle='#e8e2f0'; g.fillText(t,R+24,sy); }
          sy+=34; g.font='12px monospace'; g.fillStyle='#9a92a8';
          for(const t of ['Road distance markers','every 0.5 km (white dots).','Shading = height vs road.','Dark = edge of world.']){ g.fillText(t,R,sy); sy+=17; }
          return c.toDataURL('image/png');
        })()""")
        open('shots/tour_map.png','wb').write(base64.b64decode(url.split(',')[1]))
        await b.close()
asyncio.run(main())
