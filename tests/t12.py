import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        await ev("__dbg.setupRole('drums'); __dbg.teleport('venue'); __dbg.startPractice()"); await pg.wait_for_timeout(5000)
        print('practice srcs', await ev("[__G.perf.srcs.length, __G.perf.notes.drums.length, __G.perf.notes.drums.slice(0,6).map(n=>n.b)]"))
        await pg.screenshot(path='shots/95_practice.png')
        await ev("__dbg.abortPerf(); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(4000)
        print('gig srcs', await ev("[__G.perf.srcs.length, __G.perf.notes.drums.slice(0,8).map(n=>n.b), __G.perf.notes.bass.slice(0,10).map(n=>n.b)]"))
        print(errs)
        await b.close()
asyncio.run(main())
