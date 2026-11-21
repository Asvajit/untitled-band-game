import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        await ev("__dbg.setupRole('trumpet'); __dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startPractice()")
        await pg.wait_for_function("(()=>{const P=__G.perf; if(!P) return false; const n=P.notes.trumpet.find(n=>n.d>=1.5 && n.hit); if(!n) return false; const now=P.tnow(); return now>n.t+0.4 && now<n.t+n.d*P.spb-0.4;})()", timeout=60000, polling=50)
        await pg.screenshot(path='shots/97_holding.png', clip={'x':330,'y':40,'width':300,'height':480})
        await b.close()
asyncio.run(main())
