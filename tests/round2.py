import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.wait_for_timeout(500); await pg.screenshot(path='shots/70_title.png')
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate
        async def shot(name, js=None, wait=900):
            if js: await ev(js)
            await pg.wait_for_timeout(wait); await pg.screenshot(path=f'shots/{name}.png')
        # van doors: look at driver door from outside
        await shot('71_van_door', "(()=>{const v=__dbg.van,P=__dbg.P; v.local(3.2,0,0.6,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading-Math.PI/2; P.pitch=-0.05;})()")
        print('hover', await ev("__dbg.hover"))
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(900)
        print('doorL open', await ev("__dbg.van.doors.L.open"))
        await shot('72_van_door_open')
        # walk in through the door toward the seat
        await ev("__dbg.P.yaw=__dbg.van.heading-Math.PI/2")
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(1800); await pg.keyboard.up('KeyW')
        print('inside?', await ev("(()=>{const l=__dbg.van.root.worldToLocal(__dbg.P.pos.clone()); return [l.x.toFixed(2),l.y.toFixed(2),l.z.toFixed(2), __dbg.P.onboard]})()"))
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(400); await pg.keyboard.press('KeyN'); await pg.wait_for_timeout(700)
        await shot('73_van_radio', "__dbg.P.drvYaw=-0.5; __dbg.P.drvPitch=-0.45")
        await ev("__dbg.P.drvYaw=0; __dbg.P.drvPitch=-0.1")
        await pg.keyboard.press('KeyM'); await pg.wait_for_timeout(500); await pg.screenshot(path='shots/74_map.png'); await pg.keyboard.press('KeyM')
        # leg2 spawn
        await ev("__dbg.teleport('leg2')"); await pg.wait_for_timeout(600)
        await ev("__dbg.sit('driver')"); await shot('75_rv_spawn', wait=1500)
        # leg3 rain
        await ev("__dbg.teleport('city')"); await pg.wait_for_timeout(300)
        await ev("(()=>{const w=__dbg.world,V=__dbg.van,s=w.sNF+250,p=w.roadPoint(s); V.place(p.x-p.tz*1.8,p.z+p.tx*1.8,Math.atan2(p.tx,p.tz));})()")
        await ev("__dbg.sit('driver')"); await shot('76_bus_rain', wait=5000)
        await shot('77_bus_side', "(()=>{const v=__dbg.van,P=__dbg.P; __dbg.standUp(); v.local(-6,0,0,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading+Math.PI/2; P.pitch=0.0; __G.weather='clear';})()", 2500)
        print('rain', await ev("__G.rainAmt.toFixed(2)"))
        print(errs)
        await b.close()
asyncio.run(main())
