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
        for t in ['van','rv','bus']:
            r = await pg.evaluate("""(t)=>{const V=__dbg.vehicles[t], w=__dbg.world; const s=t==='van'?300:t==='rv'?3000:5000; const p=w.roadPoint(s);
              V.place(p.x,p.z,Math.atan2(p.tx,p.tz)); V.engineOn=true; V.handbrake=false; V.rpm=900; V.fuel=100; V.setGear('1');
              for(const bk of w.blockers) w.clearBlocker(bk); const out=[]; let g=1; const inp={throttle:1,brake:0,steer:0,clutch:false};
              for(let i=0;i<60*40;i++){ // 40 s
                 const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+12); const want=Math.atan2(q.x-V.pos.x,q.z-V.pos.z); let d=want-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3));
                 if(V.rpm>5000 && g<5){g++; V.setGear(String(g));}
                 V.update(1/60,inp);
                 if(i%600===599) out.push([Math.round(V.v*3.6), V.gear, Math.round(n.d*10)/10]);
              }
              return out;}""", t)
            print(t, r)
        print(errs)
        await b.close()
asyncio.run(main())
