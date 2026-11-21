import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        for where, off in [('leg2', 400), ('leg3', 250)]:
            await pg.evaluate(f"__dbg.teleport('{where}')"); await pg.wait_for_timeout(300)
            await pg.evaluate(f"(()=>{{const w=__dbg.world,V=__dbg.van,s=(__G.leg===1?w.sBar:w.sNF)+{off},p=w.roadPoint(s); V.place(p.x-p.tz*1.8,p.z+p.tx*1.8,Math.atan2(p.tx,p.tz)); __dbg.sit('driver');}})()")
            await pg.wait_for_timeout(4000)
            a=await pg.evaluate("__G.rainAmt"); await pg.wait_for_timeout(4000); b2=await pg.evaluate("__G.rainAmt"); print(where, 'rain', round(a,2), '->', round(b2,2))
            await pg.screenshot(path=f'shots/rain_{where}.png')
        print(errs); await b.close()
asyncio.run(main())
