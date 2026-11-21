import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.fill('#inBand', 'Rust Riddim Collective'); await pg.fill('#inName', 'Asva')
        await pg.screenshot(path='shots/120_title.png')
        await pg.click('#go'); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        print(await ev("[__G.bandName, __G.playerName]"))
        await ev("__dbg.setupRole('bass'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()")
        for k in range(5):
            await pg.wait_for_timeout(4500); await pg.screenshot(path=f'shots/121_gig{k}.png')
        print('signs up', await ev("__dbg.signs ? 0 : 0"))
        await ev("__dbg.abortPerf()"); await pg.wait_for_timeout(500)
        # step away silence check
        await ev("__dbg.startGig()"); await pg.wait_for_timeout(3000)
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(4000)
        print('away misses', await ev("[__G.perf.stats.miss, __G.perf.popups.length]"))
        print(errs)
        await b.close()
asyncio.run(main())
