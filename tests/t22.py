import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.click('#go'); await pg.wait_for_timeout(2000)
        ev=pg.evaluate
        await ev("__dbg.setupRole('trumpet'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(1500)
        await ev("__G.perf.t0 -= 98*0.75")
        await pg.wait_for_timeout(1200)
        print('active', await ev("[__G.perf.isActive('trumpet'), __dbg.stageProps.trumpet.userData.horn.visible]"))
        await pg.screenshot(path='shots/150_fp_trumpet.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(600)
        print('away horn on stand', await ev("__dbg.stageProps.trumpet.userData.horn.visible"))
        await ev("__G.perf.recentMiss=9; __dbg.forceShot(4)"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/151_angry_crowd.png')
        print(errs)
        await b.close()
asyncio.run(main())
