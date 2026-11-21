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
        ev=pg.evaluate
        r = await ev("""(()=>{const V=__dbg.van, w=__dbg.world; const p=w.roadPoint(30); V.place(p.x,p.z,Math.atan2(p.tx,p.tz)); V.engineOn=true; V.handbrake=false; V.rpm=900; V.setGear('1'); let g=1; let maxOff=0, top=0;
              const inp={throttle:1,brake:0,steer:0,clutch:false};
              for(let i=0;i<60*400;i++){
                 const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+10); const want=Math.atan2(q.x-V.pos.x,q.z-V.pos.z); let d=want-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3));
                 inp.throttle = Math.abs(V.v)>14?0:1; top=Math.max(top,V.v);
                 if(V.rpm>4800 && g<5){g++; V.setGear(String(g));} if(V.rpm<1500&&g>1){g--;V.setGear(String(g));}
                 for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
                 V.update(1/60,inp); maxOff=Math.max(maxOff,n.d);
                 if(n.s>w.sBar-30) return {arrived:i/60|0, maxOff:maxOff.toFixed(1)};
              } return {stuck:w.nearestRoad(V.pos.x,V.pos.z).s|0, maxOff};})()""")
        print('van leg1', r)
        r = await ev("""(()=>{const V=__dbg.van; const w=__dbg.world; const p=w.roadPoint(3400); V.place(p.x,p.z,Math.atan2(p.tx,p.tz)); V.engineOn=true; V.handbrake=false; const inp={throttle:1,brake:0,steer:0,clutch:false}; let g=1; V.setGear('1'); const out=[];
          for(let i=0;i<60*40;i++){ const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+16); let d=Math.atan2(q.x-V.pos.x,q.z-V.pos.z)-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3)); if(V.rpm>5600 && g<5){g++; V.setGear(String(g));} V.update(1/60,inp); if(i%600===599) out.push(Math.round(V.v*3.6)); } return out;})()""")
        print('van straight-line km/h every 10s', r)
        await ev("__dbg.teleport('leg3')"); await pg.wait_for_timeout(300)
        for i,off in enumerate([40,110,180]):
            await ev(f"(()=>{{const w=__dbg.world,V=__dbg.van,s=w.sNF+{off},p=w.roadPoint(s); V.place(p.x-p.tz*1.8,p.z+p.tx*1.8,Math.atan2(p.tx,p.tz));}})()")
            if i==0: await ev("__dbg.sit('driver')")
            await pg.wait_for_timeout(1500); await pg.screenshot(path=f'shots/8{i}_nf_exit.png')
        print(errs)
        await b.close()
asyncio.run(main())
