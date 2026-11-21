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
        await ev("__dbg.teleport('falls')"); await pg.wait_for_timeout(500)
        await shot('10_falls', "(()=>{const w=__dbg.world,P=__dbg.P,f=w.falls,p=w.roadPoint(w.sFalls-25);P.pos.set(p.x,w.roadYAt(w.sFalls-25)+0.1,p.z);P.yaw=Math.atan2(f.x-p.x,f.z-p.z);P.pitch=0.15;P.onboard=false;})()")
        # award flow from bar
        await ev("__dbg.teleport('bar')"); await pg.wait_for_timeout(300)
        await ev("showAward=null"); 
        await ev("document.getElementById('dbgbtn') && 0")
        await ev("__dbg.startLeg(1)"); await pg.wait_for_timeout(1200)
        print('leg', await ev("[__G.leg, __dbg.van.type, __G.obj, document.getElementById('obj').innerText]"))
        await shot('20_rv_start', "(()=>{const P=__dbg.P,v=__dbg.van;P.yaw=v.heading+Math.PI/2+0.5;})()")
        await ev("__dbg.sit('driver')"); await shot('21_rv_cab')
        await ev("__dbg.teleport('neon')"); await pg.wait_for_timeout(500)
        await shot('22_neon_back', "(()=>{const w=__dbg.world,P=__dbg.P,lb=w.loadingBay;P.pos.set(lb.x+16,w.venueY,lb.z+10);P.yaw=Math.atan2(-16,-22);P.pitch=0;})()")
        await ev("__dbg.startLeg(2)"); await pg.wait_for_timeout(1200)
        print('leg', await ev("[__G.leg, __dbg.van.type, __G.obj]"))
        await shot('30_bus_ext', "(()=>{const P=__dbg.P,v=__dbg.van;P.yaw=v.heading+Math.PI/2-0.35;P.pitch=0.05;})()")
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(600)
        await shot('31_bus_cab', wait=1500)
        await ev("__dbg.P.drvYaw=Math.PI; __dbg.P.drvPitch=-0.15"); await shot('32_bus_inside')
        await ev("__dbg.standUp()"); await pg.wait_for_timeout(300)
        await shot('33_bus_lounge', "(()=>{const v=__dbg.van,P=__dbg.P; v.local(0,1.02,4.2,P.pos); P.yaw=v.heading+Math.PI; P.pitch=-0.1;})()")
        await ev("__dbg.teleport('city')"); await pg.wait_for_timeout(500)
        await ev("__dbg.sit('driver')"); await shot('34_city_drive', "__G.chase=true", 1500)
        await ev("__dbg.teleport('stadium')"); await pg.wait_for_timeout(500)
        await shot('35_stadium_back', "(()=>{const w=__dbg.world,P=__dbg.P,V=w.venue.center;P.pos.set(V.x-60,w.venueY,V.z+120);P.yaw=Math.atan2(60,-120);P.pitch=0.1;})()")
        await shot('36_stadium_field', "(()=>{const w=__dbg.world,P=__dbg.P,V=w.venue.center;P.pos.set(V.x+5,w.venueY,V.z-30);P.yaw=0.05;P.pitch=0.1;})()")
        await ev("__G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(3000)
        await shot('37_stadium_gig', wait=6000)
        print(errs)
        await b.close()
asyncio.run(main())
