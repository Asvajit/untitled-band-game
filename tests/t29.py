import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate; st=lambda: ev("[__dbg.van.gear, Math.round(__dbg.van.v*3.6), Math.round(__dbg.van.rpm), __dbg.van.engineOn]")
        await ev("__dbg.sit('driver'); __G.dbg.boost=3")
        await pg.keyboard.press('KeyR'); await pg.wait_for_timeout(2500); await pg.keyboard.press('KeyP')
        await pg.screenshot(path='shots/190_legend.png')
        await pg.keyboard.down('KeyW')
        for g in range(5):
            await pg.keyboard.down('KeyQ'); await pg.mouse.wheel(0,-100); await pg.wait_for_timeout(200); await pg.keyboard.up('KeyQ')
            await pg.wait_for_timeout(2200); print('up', await st())
        await pg.keyboard.up('KeyW'); await pg.keyboard.down('KeyS'); await pg.wait_for_timeout(6000); await pg.keyboard.up('KeyS'); await pg.wait_for_timeout(800)
        print('stopped', await st())
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(2000); await pg.keyboard.up('KeyW'); print('pull away', await st())
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.v=0; __dbg.standUp(); v.local(0,1.0,0.5,P.pos); P.onboard=true; P.yaw=v.heading+Math.PI; P.pitch=-0.1;})()"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/191_rear.png')
        await b.close()
asyncio.run(main())
