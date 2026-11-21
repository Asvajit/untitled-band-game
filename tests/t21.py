import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.click('#go'); await pg.wait_for_timeout(2000)
        ev=pg.evaluate
        # loading bay overview
        await ev("(()=>{const lb=__dbg.world.loadingBay; __dbg.teleport('venue'); __G.dbg.freecam=true; __dbg.fc.pos.set(lb.x+30, lb.y+28, lb.z-40); __dbg.fc.yaw=-0.75; __dbg.fc.pitch=-0.55;})()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/140_bay.png')
        print('obj', await ev("__G.obj"))
        await ev("__G.dbg.freecam=false; __dbg.setupRole('trumpet'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(1500)
        await ev("__dbg.forceShot(1)")  # close-up order starts... just wide; fine
        await pg.wait_for_function("__G.perf && __G.perf.isActive('trumpet')", timeout=5000) if False else None
        await pg.screenshot(path='shots/141_trumpet_post.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(300)
        await ev("__dbg.P.yaw = 0; __dbg.P.pitch=-0.5; __dbg.P.pos.z -= 0.4")
        await pg.keyboard.down('KeyS'); await pg.wait_for_timeout(500); await pg.keyboard.up('KeyS'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/142_trumpet_stand.png')
        await ev("__G.dbg.autoplay=false; __G.perf.recentMiss=9"); await pg.wait_for_timeout(3000)
        await ev("__dbg.forceShot(5)"); await pg.wait_for_timeout(1500)
        print('mood', await ev("__G.mood.toFixed(2)"))
        await pg.screenshot(path='shots/143_angry.png')
        print(errs)
        await b.close()
asyncio.run(main())
