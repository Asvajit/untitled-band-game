import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':800,'height':450})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        ev=pg.evaluate
        await ev("__dbg.startLeg(1)"); await pg.wait_for_timeout(300)
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.local(-(v.dims.W+1.3),0,1.2,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading+Math.PI/2; P.pitch=0;})()")
        await pg.wait_for_timeout(1200)
        await pg.keyboard.down('KeyW')
        for i in range(8):
            await pg.wait_for_timeout(400)
            print(await ev("(()=>{const v=__dbg.van,l=v.root.worldToLocal(__dbg.P.pos.clone()); return [+l.x.toFixed(2),+l.y.toFixed(2),+l.z.toFixed(2),__dbg.P.onboard, v.inside]})()"))
        print(await ev("(()=>{const v=__dbg.van,l=v.root.worldToLocal(__dbg.P.pos.clone()); return v.cols.filter(b=>l.x+0.5>b[0]&&l.x-0.5<b[1]&&l.z+0.5>b[4]&&l.z-0.5<b[5]).map(b=>b.map(x=>+x.toFixed(2)))})()"))
        await b.close()
asyncio.run(main())
