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
        await pg.add_style_tag(content='#obj,#status,#toast,#help,#lockhint,#rolename,#dbgbtn,#prompt,#legend,#gearbox{display:none!important}')
        ev=pg.evaluate
        await ev("__dbg.startLeg(2)"); await pg.wait_for_timeout(400); await ev("__G.todOverride=0.3; __G.weather='clear'")
        views={'lounge':(0,4.2,3.14,-0.1),'bar':(0.2,2.2,3.14+0.9,-0.1),'back':(0,-1.5,0.0,-0.05),'dinette':(-0.3,2.6,3.14-0.9,-0.1),'rear':(0.2,-2.6,3.14,-0.15)}
        for n,(x,z,yaw,pitch) in views.items():
            await ev(f"(()=>{{const v=__dbg.van,P=__dbg.P; v.local({x},v.floor+0.02,{z},P.pos); P.onboard=true; P.mode='walk'; P.yaw=v.heading+{yaw}; P.pitch={pitch};}})()")
            await pg.wait_for_timeout(900); await pg.screenshot(path=f'shots/bus_{n}.png')
        await ev("__dbg.sit('driver')"); await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/bus_drive.png'); await ev("__dbg.standUp()")
        # walk up the front stairs
        await ev("(()=>{const v=__dbg.van,P=__dbg.P; v.local(-(v.dims.W+3.4),0,5.9,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.mode='walk'; P.yaw=v.heading+Math.PI/2; P.pitch=0;})()")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/bus_door.png'); print('door mats', await ev("(()=>{const o=[]; __dbg.van.autoDoors[0].piv.traverse(m=>{if(m.isMesh)o.push([m.material.transparent,+m.material.opacity.toFixed(2),'#'+m.material.color.getHexString()])}); return [o, __dbg.van.autoDoors[0].t]})()"))
        await pg.keyboard.down('KeyW')
        for i in range(30):
            await pg.wait_for_timeout(500)
            r=await ev("(()=>{const v=__dbg.van,l=v.root.worldToLocal(__dbg.P.pos.clone()); return [+l.x.toFixed(2),+l.y.toFixed(2),__dbg.P.onboard, v.inside]})()")
            if r[0]>-0.6: break
        await pg.keyboard.up('KeyW'); print('walked in', r)
        print(errs); await b.close()
asyncio.run(main())
