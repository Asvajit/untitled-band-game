import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        for name, gear, flip in [('forward along route','1',False),('reversing along route','R',False),('forward against route','1',True)]:
            r = await pg.evaluate("""([gear,flip])=>{const V=__dbg.van, w=__dbg.world, G=__G; __dbg.sit('driver'); for(const bk of w.blockers) w.clearBlocker(bk);
              const s0=1200; const p=w.roadPoint(s0); V.place(p.x+p.tz*1.8,p.z-p.tx*1.8,Math.atan2(p.tx,p.tz)+(flip?Math.PI:0)); V.engineOn=true; V.handbrake=false; V.setGear(gear);
              const n0=__dbg.toastLog.length; const inp={throttle:1,brake:0,steer:0,clutch:false};
              for(let i=0;i<60*20;i++){ G.t+=1/60; const n=w.nearestRoad(V.pos.x,V.pos.z); const dir=(flip||gear==='R')?-1:1; const q=w.roadPoint(n.s+12*dir); let d=Math.atan2(q.x-V.pos.x,q.z-V.pos.z)-V.heading-(gear==='R'?Math.PI:0); while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3*(gear==='R'?-1:1))); inp.throttle=Math.abs(V.v)>9?0:1; V.update(1/60,inp); __dbg.checkObjectives(); }
              return __dbg.toastLog.slice(n0).map(t=>t[1]).filter(t=>t.includes('Wrong'));}""", [gear, flip])
            print(name, '->', r or 'no warning')
        await b.close()
asyncio.run(main())
