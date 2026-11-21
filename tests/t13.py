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
        await ev("__dbg.setupRole('synthB'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startPractice()")
        for k in range(4):
            await pg.wait_for_timeout(2200); await pg.screenshot(path=f'shots/96_hold{k}.png')
        print(await ev("[__G.perf.songBeat().toFixed(1), JSON.stringify(__G.perf.stats)]"))
        await ev("__dbg.abortPerf(); __dbg.startGig()"); await pg.wait_for_timeout(1500)
        print('gig end beat', await ev("[__G.perf.endBeat, __G.perf.notes.bass.at(-1).b, __G.perf.notes.synthB.at(-1).b, __G.perf.notes.guitar.at(-1).b]"))
        print(errs)
        await b.close()
asyncio.run(main())
