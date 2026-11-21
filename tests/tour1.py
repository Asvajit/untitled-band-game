import asyncio, sys, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        t0=time.time()
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        print('load s', round(time.time()-t0,1))
        await pg.screenshot(path='shots/00_title.png')
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(1500)
        ev=pg.evaluate
        print(await ev("document.getElementById('obj').innerText"))
        await pg.screenshot(path='shots/01_start.png')
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/02_vancab.png')
        print(errs)
        await b.close()
asyncio.run(main())
