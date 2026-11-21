import asyncio, sys, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(1000)
        ev=pg.evaluate
        async def shot(name, js=None, wait=900):
            if js: await ev(js)
            await pg.wait_for_timeout(wait); await pg.screenshot(path=f'shots/{name}.png')
        # drive the van: engine on, 1st, gas
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(300)
        await ev("(()=>{const v=__dbg.van; v.setGear('N'); v.engineOn=true; v.rpm=900; v.handbrake=false; v.setGear('2');})()")
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(6000); 
        print('van speed km/h', await ev("Math.round(__dbg.van.v*3.6)"), 'rpm', await ev("Math.round(__dbg.van.rpm)"))
        await pg.keyboard.up('KeyW')
        await shot('40_van_drive')
        # full bar gig via autoplay to results, then click continue & award
        await ev("__dbg.teleport('bar')"); await pg.wait_for_timeout(300)
        await ev("__G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(1500)
        await ev("__G.perf.finish ? __G.perf.finish() : 0"); await pg.wait_for_timeout(800)
        print('overlay', await ev("__G.overlay"))
        await shot('41_results')
        await ev("document.getElementById('rcont').click()"); await pg.wait_for_timeout(600)
        await shot('42_award')
        await ev("document.getElementById('rgo').click()"); await pg.wait_for_timeout(1200)
        print('after award', await ev("[__G.leg, __dbg.van.type, __G.obj, __G.mode]"))
        await shot('43_rv_morning', "(()=>{const P=__dbg.P,v=__dbg.van;P.yaw=v.heading+Math.PI/2-0.9;P.pitch=0;})()")
        await ev("__dbg.teleport('leg3')"); await pg.wait_for_timeout(800)
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(1500)
        await shot('44_bus_cab')
        await ev("__dbg.P.drvYaw=-0.55; __dbg.P.drvPitch=0.25"); await shot('45_bus_monitor', wait=1500)
        info = await ev("(()=>{const r=__dbg.world.scene; let n=0; r.traverse(o=>{if(o.isMesh)n++}); return n})()")
        print('meshes', info)
        print(errs)
        await b.close()
asyncio.run(main())
