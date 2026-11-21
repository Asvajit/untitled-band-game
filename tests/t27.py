import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(1500)
        ev=pg.evaluate
        await pg.screenshot(path='shots/170_dither.png')
        # ladder
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.local(0.9,0,-6.6,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.yaw=v.heading; P.pitch=0.2;})()"); await pg.wait_for_timeout(500)
        print('hover ladder', await ev("__dbg.hover"))
        await pg.keyboard.press('KeyE'); await pg.wait_for_function("__dbg.P.mode==='walk'", timeout=20000); await pg.wait_for_timeout(300)
        print('after climb', await ev("[__dbg.P.mode, __dbg.P.onboard, __dbg.van.root.worldToLocal(__dbg.P.pos.clone()).y.toFixed(2)]"))
        await ev("__dbg.P.pitch=-0.3"); await pg.wait_for_timeout(300)
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(1800); await pg.keyboard.up('KeyW')
        await ev("__dbg.P.pitch=-0.5"); await pg.wait_for_timeout(400)
        print('roof hover', await ev("__dbg.hover"), await ev("__dbg.van.root.worldToLocal(__dbg.P.pos.clone()).toArray().map(v=>v.toFixed(2))"))
        await pg.screenshot(path='shots/171_roof.png')
        await ev("__dbg.sit('roofA')"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='shots/172_roofseat.png')
        await ev("__dbg.standUp()")
        # night drive
        await ev("__G.weather='night'; __dbg.sit('driver'); __dbg.van.headlights=true"); await pg.wait_for_timeout(4000)
        await pg.screenshot(path='shots/173_night.png')
        await ev("__G.weather='rain'; __dbg.van.headlights=false"); await pg.wait_for_timeout(9000)
        await pg.screenshot(path='shots/174_rain_nowipers.png')
        await ev("__dbg.van.wipersOn=true"); await pg.wait_for_timeout(3000)
        await pg.screenshot(path='shots/175_rain_wipers.png')
        print(errs)
        await b.close()
asyncio.run(main())
