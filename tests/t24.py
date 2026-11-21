import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate
        st=lambda: ev("[__dbg.van.gear, +__dbg.van.knob.x.toFixed(2), +__dbg.van.knob.y.toFixed(2), Math.round(__dbg.van.v*3.6), Math.round(__dbg.van.rpm), __dbg.van.engineOn]")
        await ev("__dbg.sit('driver'); __G.dbg.boost=1")
        await pg.keyboard.press('KeyR'); await pg.wait_for_timeout(2500); await pg.keyboard.press('KeyP')
        x,y=320,180
        async def drag(dx,dy,steps=12):
            nonlocal x,y
            await pg.keyboard.down('KeyQ'); await pg.mouse.move(x,y); await pg.mouse.down()
            for i in range(steps):
                await pg.mouse.move(x+dx*(i+1)/steps, y+dy*(i+1)/steps); await pg.wait_for_timeout(16)
            await pg.mouse.up(); await pg.keyboard.up('KeyQ')
            return await st()
        print('->1', await drag(-30,0), await drag(0,-150))
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(3000); print('in 1', await st())
        print('->2', await drag(0,300))
        await pg.wait_for_timeout(3000); print('in 2', await st())
        print('->3', await drag(0,-150), await drag(30,0), await drag(0,-150))
        await pg.wait_for_timeout(3000); print('in 3', await st())
        print('->4', await drag(0,300))
        await pg.wait_for_timeout(3000); print('in 4', await st())
        print('scroll down', end=' ')
        await pg.keyboard.down('KeyQ')
        for k in range(3): await pg.mouse.wheel(0,100); await pg.wait_for_timeout(250); print(await st(), end=' ')
        await pg.keyboard.up('KeyQ'); print()
        await pg.keyboard.up('KeyW')
        await b.close()
asyncio.run(main())
