import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate
        await ev("__dbg.sit('driver')"); await pg.mouse.move(640,360); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shots/200_cab.png')
        # aim at key
        best=None
        for yaw in [0.3,0.4,0.5,0.6,0.7]:
            for pit in [-0.4,-0.5,-0.6,-0.7]:
                await ev(f"__dbg.P.drvYaw={yaw}; __dbg.P.drvPitch={pit}"); await pg.wait_for_timeout(80)
                h=await ev("__dbg.hover")
                if h and 'key' in h:
                    await pg.wait_for_timeout(300)
                    if await ev('__dbg.hover'): best=(yaw,pit,h); break
            if best: break
        print('key aim', best)
        await pg.screenshot(path='shots/201_key.png')
        print('hover before', await ev('__dbg.hover'))
        await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(1800)
        print('hover after', await ev('__dbg.hover'), await ev('[__dbg.P.drvYaw, __dbg.P.drvPitch, __dbg.van.crank, __dbg.van.gear, __dbg.van.fuel]'))
        print('engine', await ev("__dbg.van.engineOn"))
        await ev("__dbg.P.drvYaw=-0.1; __dbg.P.drvPitch=0.25"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shots/202_mirror.png')
        print(errs)
        await b.close()
asyncio.run(main())
