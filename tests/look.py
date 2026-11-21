import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(600)
        ev=pg.evaluate
        await ev("__G.todOverride=0.3; __G.weather='clear'")
        await pg.add_style_tag(content='#obj,#status,#toast,#help,#crosshair,#lockhint,#rolename,#dbgbtn,#prompt{display:none!important}')
        for leg,name in [(0,'van'),(1,'rv'),(2,'bus')]:
            if leg: await ev(f"__dbg.startLeg({leg})"); await pg.wait_for_timeout(500)
            await ev("__G.todOverride=0.3; __G.weather='clear'")
            for tag,(lx,lz,ly) in {'fl':(-5.2,5.6,1.9),'rr':(5.2,-6,2.3)}.items():
                k = 1 if name=='van' else 1.75 if name=='rv' else 1.9
                await ev(f"""(()=>{{const v=__dbg.van,fc=__dbg.fc; __G.dbg.freecam=true; const p=v.local({lx*k},{ly*k},{lz*k}); const c=v.local(0,1.4,0);
                  fc.pos.copy(p); __dbg.P.pos.set(p.x, -50, p.z); const dx=c.x-p.x,dy=c.y-p.y,dz=c.z-p.z; fc.yaw=Math.atan2(dx,dz); fc.pitch=Math.atan2(dy,Math.hypot(dx,dz));}})()""")
                await pg.wait_for_timeout(700); await pg.screenshot(path=f'shots/look_{name}_{tag}.png')
            await ev("__G.dbg.freecam=false")
        if len(sys.argv)>1:
            await ev("__dbg.teleport('falls')"); await ev("__G.todOverride=0.3")
            await ev("(()=>{const w=__dbg.world,P=__dbg.P,f=w.falls,p=w.roadPoint(w.sFalls-20);P.pos.set(p.x,w.roadYAt(w.sFalls-20)+0.1,p.z);P.yaw=Math.atan2(f.x-p.x,f.z-p.z);P.pitch=0.12;P.onboard=false;})()")
            await pg.wait_for_timeout(900); await pg.screenshot(path='shots/look_falls.png')
        print(errs); await b.close()
asyncio.run(main())
