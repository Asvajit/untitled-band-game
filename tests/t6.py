import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(400)
        ev=pg.evaluate
        await ev("__dbg.boardVan(); __dbg.P.camYaw=Math.PI*0.9; __dbg.P.camPitch=0.6"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/40_inside.png')
        await pg.keyboard.down('KeyS'); await pg.wait_for_timeout(1500); await pg.keyboard.up('KeyS')
        print('hover', await ev("__dbg.hover"), await ev("[__dbg.P.lp.x,__dbg.P.lp.z]"))
        await ev("__dbg.P.lp.set(0,0.9,1.4); __dbg.P.camYaw=0; __dbg.P.camPitch=0.5"); await pg.wait_for_timeout(600)
        print('hover2', await ev("__dbg.hover"))
        await pg.screenshot(path='shots/41_inside_front.png')
        # chase cam driving off-road for tuning
        await ev("__dbg.sit('driver'); const v=__dbg.van; v.engineOn=true; v.gear='2'; v.handbrake=false; __G.chase=true; __G.dbg.boost=3")
        await pg.keyboard.down('KeyW'); await pg.keyboard.down('KeyA'); await pg.wait_for_timeout(6000); await pg.keyboard.up('KeyA'); await pg.keyboard.up('KeyW')
        print('tuning', await ev("JSON.stringify(__G.tuning)"), await ev("[__dbg.van.offroad, __dbg.van.health, __dbg.van.v]"))
        await pg.screenshot(path='shots/42_offroad.png')
        print(errs)
        await b.close()
asyncio.run(main())
