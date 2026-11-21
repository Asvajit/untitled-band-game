import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        await pg.evaluate("__dbg.teleport('leg2')"); await pg.wait_for_timeout(500)
        # terrain holes near road: sample offsets
        holes = await pg.evaluate("""(()=>{const w=__dbg.world; const out=[]; for(let s=0;s<w.length;s+=20){const p=w.roadPoint(s); for(const o of [-12,-30,12,30]){const x=p.x-p.tz*o,z=p.z+p.tx*o; const h=w.sampleTerrain(x,z); if(Math.abs(h-p.y)>25) out.push([Math.round(s),o,Math.round(h),Math.round(p.y)]);}} return out.slice(0,30);})()""")
        print('holes', holes)
        r = await pg.evaluate("""(()=>{const V=__dbg.van, w=__dbg.world; V.engineOn=true; V.handbrake=false; V.rpm=900; V.fuel=100; V.setGear('1'); let g=1;
              const out=[]; const inp={throttle:1,brake:0,steer:0,clutch:false}; let stuck=0, last=0;
              for(let i=0;i<60*240;i++){
                 const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+14); const want=Math.atan2(q.x-V.pos.x,q.z-V.pos.z); let d=want-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3));
                 inp.throttle = Math.abs(V.v)>18?0:1;
                 if(V.rpm>4800 && g<5){g++; V.setGear(String(g));} if(V.rpm<1500&&g>1){g--;V.setGear(String(g));}
                 for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
                 V.update(1/60,inp);
                 if(i%600===0) out.push([Math.round(n.s), Math.round(V.v*3.6), V.gear, +n.d.toFixed(1)]);
                 if(n.s>w.sNF) {out.push(['arrived',i/60]); break;}
              } return out;})()""")
        print(r)
        print(errs)
        await b.close()
asyncio.run(main())
