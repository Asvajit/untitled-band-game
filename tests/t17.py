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
        await ev("__dbg.setupRole('bass'); __dbg.teleport('venue'); __dbg.startGig()"); await pg.wait_for_timeout(5000)
        print('at post gain', await ev("__G.perf.gains.bass.gain.value.toFixed(2)"))
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(1500)
        print('away gain', await ev("[__G.perf.gains.bass.gain.value.toFixed(3), __G.perf.gains.guitar.gain.value.toFixed(2)]"))
        await ev("(()=>{const s=__dbg.world.bandSpots.bass; __dbg.P.pos.set(s.x+0.5, __dbg.world.stage.top, s.z+0.2);})()"); await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(1500)
        print('back gain', await ev("__G.perf.gains.bass.gain.value.toFixed(2)"))
        print(errs)
        await b.close()
asyncio.run(main())
