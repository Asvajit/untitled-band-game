import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(300)
        ev=pg.evaluate
        await ev("__dbg.boardVan(true); __dbg.sit('driver'); const v=__dbg.van; v.engineOn=true; v.rpm=900; v.handbrake=false;")
        await pg.wait_for_timeout(300)
        async def drag(dx, dy, clutch=True):
            if clutch: await pg.keyboard.down('KeyQ')
            await pg.mouse.move(640,360); await pg.mouse.down(button='right')
            steps=10
            for i in range(steps):
                await pg.mouse.move(640+dx*(i+1)/steps, 360+dy*(i+1)/steps)
                await pg.wait_for_timeout(30)
            await pg.mouse.up(button='right')
            if clutch: await pg.keyboard.up('KeyQ')
            return await ev("[__dbg.van.gear, +__dbg.van.knob.x.toFixed(2), +__dbg.van.knob.y.toFixed(2)]")
        print('no clutch to 1:', await drag(-140, 0, False), await drag(0,-160,False))
        print('back to N rail', await ev("__dbg.van.setGear('N'); __dbg.van.gear"))
        print('to 1 w/ clutch:', await drag(-140,0), await drag(0,-160))
        await pg.screenshot(path='shots/50_gear1.png')
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(4000)
        print('speed in 1', await ev("[__dbg.van.v*3.6, __dbg.van.rpm]"))
        print('1->2:', await drag(0, 300))
        await pg.wait_for_timeout(4000)
        print('speed in 2', await ev("[__dbg.van.v*3.6, __dbg.van.rpm, __dbg.van.engineOn]"))
        print('2->3:', await drag(0,-150), await drag(140,0), await drag(0,-160))
        await pg.wait_for_timeout(4000)
        print('speed in 3', await ev("[__dbg.van.v*3.6, __dbg.van.rpm, __dbg.van.engineOn]"))
        await pg.screenshot(path='shots/51_gear3.png')
        await pg.keyboard.up('KeyW')
        print(errs)
        await b.close()
asyncio.run(main())
