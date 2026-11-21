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
        await ev("__dbg.sit('driver'); const v=__dbg.van; v.engineOn=true; v.handbrake=false; v.setGear('3'); v.v=5;")
        await pg.keyboard.down("KeyS")
        for i in range(6):
            await pg.wait_for_timeout(400); print(await ev("[__dbg.van.gear, __dbg.van.v.toFixed(2), __dbg.van.automatic, __dbg.van.stopT]"))
        await b.close()
asyncio.run(main())
