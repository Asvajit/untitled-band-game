import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.screenshot(path='shots/90_title.png')
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(3000)
        ev=pg.evaluate
        print('stems', await ev("Object.keys(__dbg.van && window.__G ? (window.__audioStems||{}) : {})"))
        await ev("__dbg.setupRole('trumpet'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(6000)
        print('perf', await ev("__G.perf && [__G.perf.songBeat().toFixed(1), __G.perf.score, __G.perf.isActive('trumpet')]"))
        await pg.screenshot(path='shots/91_groove.png')
        # jump to chorus: can't seek; check note counts
        print('notes', await ev("Object.fromEntries(Object.entries(__G.perf.notes).map(([k,v])=>[k,v.length]))"))
        await ev("__dbg.abortPerf(); __dbg.setupRole('bass'); __dbg.startGig()"); await pg.wait_for_timeout(9000)
        print('bass perf', await ev("__G.perf && [__G.perf.songBeat().toFixed(1), __G.perf.score, JSON.stringify(__G.perf.stats)]"))
        await pg.screenshot(path='shots/92_bass.png')
        await ev("__dbg.abortPerf(); __dbg.startPractice()"); await pg.wait_for_timeout(6000)
        print('practice', await ev("__G.perf && [__G.perf.songBeat().toFixed(1), __G.perf.score]"))
        await pg.screenshot(path='shots/93_practice.png')
        print(errs[:10])
        await b.close()
asyncio.run(main())
