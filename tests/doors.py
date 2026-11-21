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
        for leg,(dz) in [(0,-0.55),(1,2.1),(2,6.0)]:
            if leg: await ev(f"__dbg.startLeg({leg})"); await pg.wait_for_timeout(300)
            await ev(f"(()=>{{const v=__dbg.van,P=__dbg.P; v.local(-(v.dims.W+1.3),0,{dz},P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading+Math.PI/2; P.pitch=0;}})()")
            await pg.wait_for_timeout(700)
            t0 = await ev("__dbg.van.autoDoors[0].t")
            await pg.screenshot(path=f'shots/door_{leg}_far.png')
            await pg.wait_for_timeout(1500); t0 = await ev("__dbg.van.autoDoors[0].t"); await pg.screenshot(path=f'shots/door_{leg}_near.png'); await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(5000); await pg.keyboard.up('KeyW')
            r = await ev("(()=>{const v=__dbg.van,l=v.root.worldToLocal(__dbg.P.pos.clone()); return [+l.x.toFixed(2),+l.y.toFixed(2),+l.z.toFixed(2),__dbg.P.onboard, +v.autoDoors[0].t.toFixed(2)]})()")
            print('leg',leg+1,'door t far',t0,'-> after walking in', r)
        print(errs); await b.close()
asyncio.run(main())
