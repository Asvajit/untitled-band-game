import asyncio, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8765/tpose.html'); await pg.wait_for_function('window.ready')
        url = await pg.evaluate('makeSheet()'); open('shots/robots_tpose.png','wb').write(base64.b64decode(url.split(',')[1]))
        glb = await pg.evaluate('makeGLB()'); open('shots/loose_wires_robots_tpose.glb','wb').write(base64.b64decode(glb))
        print(errs); await b.close()
asyncio.run(main())
