import asyncio, base64, sys, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/glbview.html'); await pg.wait_for_function('window.ready')
        r = await pg.evaluate(f"run('{sys.argv[1]}', {sys.argv[2] if len(sys.argv)>2 else 1})")
        for i in r['info']:
            if len(sys.argv)<4 or i[3][1] < float(sys.argv[3]): print(i)
        print('bbox', r['bb'])
        for k,v in r['out'].items(): open(f'shots/glb_{k}.png','wb').write(base64.b64decode(v.split(',')[1]))
        print(errs); await b.close()
asyncio.run(main())
