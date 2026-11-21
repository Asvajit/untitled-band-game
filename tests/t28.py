import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(800)
        ev=pg.evaluate
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.local(0,1.0,0.5,P.pos); P.onboard=true; P.yaw=v.heading+Math.PI; P.pitch=-0.1;})()"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/180_rear_in.png')
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.local(-0.6,0,-9,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.yaw=v.heading; P.pitch=0.05;})()"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/181_rear_out.png')
        await b.close()
asyncio.run(main())
