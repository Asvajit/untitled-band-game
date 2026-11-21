import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':800,'height':450})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        r = await pg.evaluate("""(()=>{const V=__dbg.vehicles.bus; const out=[]; V.shell.traverse(o=>{ if(o.isMesh){ const g=o.geometry; g.computeBoundingBox(); const m=o.material; out.push([o.name.slice(0,26), o.visible, m.transparent, +m.opacity.toFixed(2), '#'+m.color.getHexString(), (g.index?g.index.count:g.attributes.position.count)/3|0, g.boundingBox.min.toArray().map(v=>+v.toFixed(1)).join(','), g.boundingBox.max.toArray().map(v=>+v.toFixed(1)).join(',')]); }}); return out;})()""")
        for x in r: print(x)
        await b.close()
asyncio.run(main())
