import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        await ev("__dbg.setupRole('bass'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(5000)
        await pg.screenshot(path='shots/110_fp_guitar.png')
        # close look at the bass bot via free camera
        await ev("(()=>{const s=__dbg.world.bandSpots.bass, top=__dbg.world.stage.top; __G.dbg.freecam=true; __dbg.fc.pos.set(s.x+0.6, top+1.3, s.z-2.2); __dbg.fc.yaw=-0.25; __dbg.fc.pitch=-0.12;})()")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/111_bass_bot.png')
        print(errs)
        await b.close()
asyncio.run(main())
