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
        await ev("__dbg.setupRole('guitar'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(7000)
        await pg.screenshot(path='shots/100_post.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(400)
        await ev("__dbg.P.yaw = Math.PI/2")
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(1500); await pg.keyboard.up('KeyW')
        await ev("__dbg.P.yaw = Math.PI*0.9; __dbg.P.pitch=-0.1"); await pg.wait_for_timeout(1500)
        print('roam', await ev("[__dbg.P.mode, __G.atPost, __dbg.P.pos.x.toFixed(1), __dbg.P.pos.y.toFixed(2), __dbg.P.pos.z.toFixed(1), __G.perf.stats.miss]"))
        await pg.screenshot(path='shots/101_roam.png')
        await ev("(()=>{const s=__dbg.world.bandSpots.guitar; __dbg.P.pos.set(s.x+0.5, __dbg.world.stage.top, s.z+0.2);})()"); await pg.wait_for_timeout(400)
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(500)
        print('back', await ev("[__dbg.P.mode, __G.atPost]"))
        print(errs)
        await b.close()
asyncio.run(main())
