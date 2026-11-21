import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate; st=lambda: ev("[__dbg.van.gear, Math.round(__dbg.van.v*3.6)]")
        await ev("__dbg.sit('driver')")
        await pg.keyboard.press('KeyR'); await pg.wait_for_timeout(2500); await pg.keyboard.press('KeyP')
        for trial in range(3):
            # shift N->1 while stopped, wait 2s before gas
            await pg.keyboard.down('KeyQ'); await pg.mouse.wheel(0,-100); await pg.wait_for_timeout(200); await pg.keyboard.up('KeyQ')
            await pg.wait_for_timeout(2000); print('sitting in gear', await st())
            await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(2500); await pg.keyboard.up('KeyW'); print('driving', await st())
            await pg.keyboard.down('KeyS'); await pg.wait_for_timeout(3500); await pg.keyboard.up('KeyS'); await pg.wait_for_timeout(600); print('stopped', await st())
        await b.close()
asyncio.run(main())
