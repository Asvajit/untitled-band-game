import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        logs=[]
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.click('#go'); await pg.wait_for_timeout(500)
        ev = pg.evaluate
        # walk to driver door: look at it
        await ev("__dbg.boardVan(true); __dbg.sit('driver')"); await pg.wait_for_timeout(300)
        await ev("__dbg.P.drvYaw=0.388; __dbg.P.drvPitch=-0.635"); await pg.wait_for_timeout(400)
        print('hover key:', await ev("__dbg.hover"))
        await pg.screenshot(path='shots/30_key.png')
        await pg.mouse.click(640,360); await pg.wait_for_timeout(1800)
        print('engine', await ev("[__dbg.van.engineOn, __dbg.van.gear]"))
        await ev("__dbg.P.drvYaw=-0.92; __dbg.P.drvPitch=-0.75"); await pg.wait_for_timeout(400)
        print('hover gear:', await ev("__dbg.hover"))
        await pg.mouse.click(640,360); await pg.wait_for_timeout(300)
        print('gear after no-clutch click', await ev("__dbg.van.gear"))
        await pg.keyboard.down('ShiftLeft'); await pg.mouse.click(640,360); await pg.keyboard.up('ShiftLeft'); await pg.wait_for_timeout(300)
        print('gear after clutch click', await ev("__dbg.van.gear"))
        # handbrake
        await ev("__dbg.P.drvYaw=-0.6; __dbg.P.drvPitch=-1.0"); await pg.wait_for_timeout(300)
        print('hover hb?:', await ev("__dbg.hover"))
        await ev("__dbg.van.handbrake=false; __dbg.P.drvYaw=0; __dbg.P.drvPitch=-0.2")
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(5000); await pg.keyboard.up('KeyW')
        print('v,rpm,gear,engine', await ev("[__dbg.van.v, __dbg.van.rpm, __dbg.van.gear, __dbg.van.engineOn]"))
        await pg.screenshot(path='shots/31_cab_driving.png')
        # rest stop flow: teleport, buy cell, plug in
        await ev("__dbg.teleport('rest')"); await pg.wait_for_timeout(500)
        print('obj', await ev("__G.obj"))
        # walk player to the cell shop spot
        await ev("""(()=>{const w=__dbg.world, s=w.shopSpots[0], F=w.restFrame; const P=__dbg.P; P.pos.set(s.x - F.rx*1.4, w.groundY.rest, s.z - F.rz*1.4); P.camYaw=Math.atan2(F.rx,F.rz); P.camPitch=0.35;})()"""); await pg.wait_for_timeout(600)
        print('hover shop:', await ev("__dbg.hover"))
        await pg.screenshot(path='shots/32_shop.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(300)
        print('carry', await ev("[__G.carrying, __G.coins]"))
        # go to rear port
        await ev("""(()=>{const v=__dbg.van, P=__dbg.P; const p=v.local(0.9,0,-5.6); P.pos.set(p.x, __dbg.world.walkH(p.x,p.z,50), p.z); P.camYaw=v.heading; P.camPitch=0.15;})()"""); await pg.wait_for_timeout(600)
        print('hover port:', await ev("__dbg.hover"))
        await pg.screenshot(path='shots/33_port.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(300)
        print('fuel,obj', await ev("[__dbg.van.fuel, __G.obj]"))
        # drive arrival at venue by placing van near
        await ev("(()=>{const w=__dbg.world, p=w.roadPoint(w.length-30); __dbg.van.place(p.x,p.z,0);})()"); await pg.wait_for_timeout(500)
        print('obj after venue', await ev("__G.obj"))
        # setlist
        await ev("__dbg.teleport('backstage')"); 
        await ev("""(()=>{const w=__dbg.world, sb=w.setlistBoard, P=__dbg.P; P.pos.set(sb.x, w.venueY, sb.z-2.2); P.camYaw=0; P.camPitch=0.2;})()"""); await pg.wait_for_timeout(600)
        print('hover board:', await ev("__dbg.hover"))
        await pg.screenshot(path='shots/34_board.png')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/35_setlist.png')
        for sid in ['battery','neon','static']:
            await pg.click(f'.song[data-id="{sid}"]')
        await pg.click('#slok'); await pg.wait_for_timeout(300)
        print('setlist,obj', await ev("[__G.setlist, __G.obj]"))
        await ev("__G.dbg.autoplay=true; __dbg.setupRole('turntable'); __dbg.startGig()"); await pg.wait_for_timeout(9000)
        await pg.screenshot(path='shots/36_gig_tt.png')
        # finish quickly: simulate by calling finish
        await ev("__G.perf.finish()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shots/37_results.png')
        for l in logs[:30]: print(l)
        await b.close()
asyncio.run(main())
