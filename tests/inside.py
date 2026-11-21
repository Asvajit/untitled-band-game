import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        ev=pg.evaluate
        for leg,(z,dz) in [(0,(-0.5,-0.55)),(1,(0.8,1.2))]:
            if leg: await ev(f"__dbg.startLeg({leg})"); await pg.wait_for_timeout(300)
            await ev("__G.todOverride=0.3; __G.weather='clear'")
            await ev(f"(()=>{{const v=__dbg.van,P=__dbg.P; v.local(-0.3,v.floor+0.02,{z},P.pos); P.onboard=true; P.mode='walk'; P.yaw=v.heading+0.3; P.pitch=-0.05;}})()")
            await pg.wait_for_timeout(900); print('inside walk', await ev("__dbg.van.inside")); await pg.screenshot(path=f'shots/in_{leg}_walk.png')
            await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(900); print('inside drive', await ev("__dbg.van.inside")); await pg.screenshot(path=f'shots/in_{leg}_drive.png')
            await ev("__G.chase=true"); await pg.wait_for_timeout(900); print('chase', await ev("__dbg.van.inside")); await pg.screenshot(path=f'shots/in_{leg}_chase.png'); await ev("__G.chase=false; __dbg.standUp()")
            await ev(f"(()=>{{const v=__dbg.van,P=__dbg.P; v.local(-(v.dims.W+2.6),0,{dz}+0.6,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading+Math.PI/2+0.2; P.pitch=0.05;}})()")
            await pg.wait_for_timeout(1500); await pg.screenshot(path=f'shots/in_{leg}_door.png')
        print(errs); await b.close()
asyncio.run(main())
