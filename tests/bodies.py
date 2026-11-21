import asyncio, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/bodies.html'); await pg.wait_for_function('window.ready')
        url = await pg.evaluate('makeSheet()'); open('shots/robot_body_concepts.png','wb').write(base64.b64decode(url.split(',')[1]))
        print(errs); await b.close()
asyncio.run(main())
