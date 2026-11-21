import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(300)
        ev=pg.evaluate; st=lambda: ev("[__dbg.van.gear, +(__dbg.van.v*3.6).toFixed(1), Math.round(__dbg.van.rpm), __dbg.van.engineOn, __dbg.van.handbrake]")
        await ev("__dbg.sit('driver')")
        await pg.keyboard.press('KeyR'); await pg.wait_for_timeout(3500)
        print('started', await st())
        await pg.keyboard.down('KeyW')
        for i in range(6): await pg.wait_for_timeout(1500); print('W', await st())
        await pg.keyboard.up('KeyW'); await pg.keyboard.down('KeyS')
        for i in range(8): await pg.wait_for_timeout(1500); print('S', await st())
        await pg.keyboard.up('KeyS')
        await pg.screenshot(path='shots/80_auto.png')
        print(errs)
        await b.close()
asyncio.run(main())
