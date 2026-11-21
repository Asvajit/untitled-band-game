import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.fill('#inName', 'Asva'); await pg.click('#go'); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        await ev("__dbg.setupRole('bass'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(3000)
        await ev("__dbg.forceShot(1)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/130_close.png')
        await ev("__dbg.forceShot(4)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/131_crowd.png')
        print(errs)
        await b.close()
asyncio.run(main())
