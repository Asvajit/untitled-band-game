import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        logs=[]
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none' || document.getElementById('loading').textContent.startsWith('Error')", timeout=90000)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/01_title.png')
        await pg.click('#go')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/02_start.png')
        for l in logs[:40]: print(l)
        await b.close()
asyncio.run(main())
