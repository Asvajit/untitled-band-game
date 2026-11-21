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
        await ev("__dbg.sit('driver')")
        await pg.keyboard.press('KeyR'); await pg.wait_for_timeout(2500); await pg.keyboard.press('KeyP')
        await ev("__dbg.van.setGear('1')")
        await pg.keyboard.down('KeyW')
        for i in range(6):
            await pg.wait_for_timeout(700)
            print(await ev("(()=>{const v=__dbg.van; return [v.gear, Math.round(v.v*3.6), Math.round(v.rpm), v.handbrake, v.offroad, v.pitch.toFixed(3), v.engineOn, v.health, v.fuel.toFixed(0), JSON.stringify(v.pos)]})()"))
        await b.close()
asyncio.run(main())
