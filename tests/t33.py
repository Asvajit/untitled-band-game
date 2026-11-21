import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(1500)
        ev=pg.evaluate
        f0=await ev("__dbg.van.fuel"); await pg.wait_for_timeout(4000); print('solar day', f0, await ev("[__dbg.van.fuel, __dbg.van.solar]"))
        await ev("__G.weather='rain'"); await pg.wait_for_timeout(4000); print('solar rain', await ev("__dbg.van.solar.toFixed(2)"))
        await ev("__G.weather='clear'"); 
        await ev("__dbg.teleport('studio')"); await pg.wait_for_timeout(500)
        await ev("(()=>{const w=__dbg.world, F=w.studioFrame, P=__dbg.P; P.pos.set(F.x+F.rx*16, F.y, F.z+F.rz*16); P.yaw=Math.atan2(F.rx,F.rz); P.pitch=0.05;})()"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/210_studio_out.png')
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(3000); await pg.keyboard.up('KeyW'); await pg.wait_for_timeout(300)
        print('inside pos b', await ev("(()=>{const F=__dbg.world.studioFrame,P=__dbg.P; return ((P.pos.x-F.x)*F.rx+(P.pos.z-F.z)*F.rz).toFixed(1)})()"))
        await pg.screenshot(path='shots/211_studio_in.png')
        # go to own instrument (drums)
        await ev("(()=>{const sp=__dbg.world.studioSpots.drums,P=__dbg.P; P.pos.set(sp.x+Math.sin(sp.yaw)*1.4, sp.y, sp.z+Math.cos(sp.yaw)*1.4); P.yaw=sp.yaw+Math.PI; P.pitch=-0.3;})()"); await pg.wait_for_timeout(500)
        print('hover', await ev("__dbg.hover"))
        await ev("__G.dbg.autoplay=true"); await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(5000)
        print('practice', await ev("[__G.mode, __G.perf && __G.perf.score]"))
        await pg.screenshot(path='shots/212_practice_fp.png')
        # roof panels
        await ev("__dbg.abortPerf(); (()=>{const v=__dbg.van; __G.dbg.freecam=true; v.local(4,7,-9,__dbg.fc.pos); const d=v.local(0,3.5,-3).sub(__dbg.fc.pos).normalize(); __dbg.fc.yaw=Math.atan2(d.x,d.z); __dbg.fc.pitch=Math.asin(d.y);})()"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/213_solar.png')
        print(errs)
        await b.close()
asyncio.run(main())
