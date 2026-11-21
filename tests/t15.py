import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        await ev("__dbg.setupRole('trumpet'); __dbg.teleport('venue'); __dbg.startGig()"); await pg.wait_for_timeout(15000)
        print(await ev("JSON.stringify(Object.fromEntries(Object.entries(__G.perf.bot).map(([k,v])=>[k,[v.hit,v.total]])))"))
        print(errs)
        await b.close()
asyncio.run(main())
