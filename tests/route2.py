import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        await pg.evaluate("__dbg.teleport('leg2')"); await pg.wait_for_timeout(500)
        await pg.evaluate("__dbg.sit('driver')"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/60_rv_spawn_view.png')
        for i,off in enumerate([60,250,500,900]):
            await pg.evaluate(f"(()=>{{const w=__dbg.world,V=__dbg.van,s=w.sBar+{off},p=w.roadPoint(s); V.place(p.x-p.tz*1.8,p.z+p.tx*1.8,Math.atan2(p.tx,p.tz));}})()")
            await pg.wait_for_timeout(1500); await pg.screenshot(path=f'shots/6{i+1}_rv_road.png')
        await b.close()
asyncio.run(main())
