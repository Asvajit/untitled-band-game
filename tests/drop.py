import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""(()=>{const w=__dbg.world; let mg=0,at=0; for(let i=1;i<=w.N;i++){const g=Math.abs(w.ry[i]-w.ry[i-1])/w.step; if(g>mg){mg=g;at=i*w.step|0;}}
          const bad=[]; for(let s=w.sNF-100;s<w.length;s+=10){const p=w.roadPoint(s); for(const o of [-6,6,-10,10]){const x=p.x-p.tz*o,z=p.z+p.tx*o; const h=w.sampleTerrain(x,z); if(Math.abs(h-p.y)>2.5) bad.push([s|0,o,+(h-p.y).toFixed(1)]);}}
          return {maxGrade:mg.toFixed(3), at, sNF:w.sNF|0, bad:bad.slice(0,40), nbad:bad.length};})()""")
        print(r)
        await pg.evaluate("__dbg.teleport('leg3')"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""(()=>{const V=__dbg.van, w=__dbg.world; V.engineOn=true; V.handbrake=false; V.rpm=900; V.setGear('1'); let g=1;
              const out=[]; const inp={throttle:1,brake:0,steer:0,clutch:false};
              for(let i=0;i<60*200;i++){
                 const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+16); const want=Math.atan2(q.x-V.pos.x,q.z-V.pos.z); let d=want-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3));
                 inp.throttle = Math.abs(V.v)>15?0:1;
                 if(V.rpm>4800 && g<5){g++; V.setGear(String(g));} if(V.rpm<1500&&g>1){g--;V.setGear(String(g));}
                 for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
                 V.update(1/60,inp);
                 if(i%300===0) out.push([n.s|0, Math.round(V.v*3.6), +n.d.toFixed(1), +V.y.toFixed(1)]);
                 if(n.s>w.length-80){out.push('arrived');break;}
              } return out;})()""")
        print(r)
        print(errs)
        await b.close()
asyncio.run(main())
