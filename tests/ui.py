import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('response', lambda r: errs.append(f'{r.status} {r.url}') if r.status>=400 else None)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.wait_for_timeout(800); await pg.screenshot(path='shots/50_title.png')
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        await pg.keyboard.press('KeyM'); await pg.wait_for_timeout(500); await pg.screenshot(path='shots/51_map.png')
        await pg.keyboard.press('KeyM'); await pg.keyboard.press('Backquote'); await pg.wait_for_timeout(500); await pg.screenshot(path='shots/52_debug.png')
        print(errs)
        await b.close()
asyncio.run(main())
