import asyncio, sys, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(1000)
        ev=pg.evaluate
        async def shot(name, js=None, wait=900):
            if js: await ev(js)
            await pg.wait_for_timeout(wait); await pg.screenshot(path=f'shots/{name}.png')
        # waterfall view from the road
        await ev("__dbg.teleport('falls')"); await pg.wait_for_timeout(500)
        await shot('10_falls', "(()=>{const w=__dbg.world,P=__dbg.P,f=w.falls,p=w.roadPoint(w.sFalls-30);P.pos.set(p.x,w.roadYAt(w.sFalls-30)+0.1,p.z);P.yaw=Math.atan2(f.x-p.x,f.z-p.z);P.pitch=0.12;P.onboard=false;})()")
        await shot('11_bridge', "(()=>{const w=__dbg.world,P=__dbg.P,f=w.falls,p=w.roadPoint(w.sFalls+60);P.pos.set(p.x,w.roadYAt(w.sFalls+60)+0.1,p.z);P.yaw=Math.atan2(-p.tx,-p.tz)+0.4;P.pitch=-0.05;})()")
        # bar exterior + interior
        await ev("__dbg.teleport('bar')"); await pg.wait_for_timeout(600)
        print('obj', await ev("__G.obj"), await ev("__G.leg"))
        await shot('12_bar_back', "(()=>{const w=__dbg.world,P=__dbg.P,V=w.venue.center;P.pos.set(V.x+14,V.y,V.z+30);P.yaw=Math.atan2(-14,-24);P.pitch=0;})()")
        await shot('13_bar_in', "(()=>{const w=__dbg.world,P=__dbg.P,V=w.venue.center;P.pos.set(V.x+1,V.y,V.z-8);P.yaw=0;P.pitch=0.02;})()")
        await ev("__G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(4000)
        await shot('14_bar_gig', wait=4000)
        print(errs)
        await b.close()
asyncio.run(main())
