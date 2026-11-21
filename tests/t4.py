import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        print(await pg.evaluate("(()=>{const w=__dbg.world; let tris=0; w.scene.traverse(o=>{if(o.isMesh&&o.geometry){const g=o.geometry; const n=(g.index?g.index.count:g.attributes.position.count)/3; tris+= o.isInstancedMesh? n*o.count : n;}}); return {len:w.length, rest:w.sRest, tris:Math.round(tris), calls:0};})()"))
        await pg.click('#go'); await pg.wait_for_timeout(1500)
        print(await pg.evaluate("(()=>{const i=document.querySelector('canvas'); return null})()"))
        await b.close()
asyncio.run(main())
