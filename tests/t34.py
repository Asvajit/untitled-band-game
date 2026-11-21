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
        # stand on roof behind the chairs, look at chair A
        for (lx,lz,name) in [(-0.55,-0.3,'A'),(0.55,-0.3,'B')]:
            await ev(f"(()=>{{const v=__dbg.van,P=__dbg.P; v.local({lx},3.6,{lz},P.pos); P.onboard=true; P.mode='walk'; P.vy=0; P.yaw=v.heading; P.pitch=-0.6;}})()"); await pg.wait_for_timeout(500)
            print(name, 'hover', await ev("__dbg.hover"))
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(500)
        print('seat', await ev("[__dbg.P.mode, __dbg.P.seat]"))
        await pg.screenshot(path='shots/220_roofsit.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(500)
        print('after stand', await ev("[__dbg.P.mode, __dbg.van.root.worldToLocal(__dbg.P.pos.clone()).y.toFixed(2)]"))
        print(errs)
        await b.close()
asyncio.run(main())
