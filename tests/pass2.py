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
        print('terrain over/under road:', await ev("""(()=>{const w=__dbg.world; const bad=[]; let worst=0; for(let s=0;s<w.length;s+=4){ if(Math.abs(s-w.sFalls)<26) continue; const p=w.roadPoint(s); for(const o of [-4.4,-2,0,2,4.4,-8,8]){const x=p.x-p.tz*o,z=p.z+p.tx*o; const dh=w.sampleTerrain(x,z)-p.y; if(Math.abs(o)<5 ? dh>0.04 : Math.abs(dh)>3){ bad.push([s|0,o,+dh.toFixed(2)]);} worst=Math.max(worst,Math.abs(o)<5?dh:0);} } return {n:bad.length, worst:+worst.toFixed(2), sample:bad.slice(0,8)};})()"""))
        await ev("__dbg.startLeg(1)"); await pg.wait_for_timeout(300)
        await ev("__G.weather='clear'; __G.todOverride=0.35")
        await ev("(()=>{const w=__dbg.world,V=__dbg.van,s=w.sNF-330,p=w.roadPoint(s); V.place(p.x-p.tz*1.8,p.z+p.tx*1.8,Math.atan2(p.tx,p.tz)); __dbg.sit('driver');})()")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/p2_nf_road.png')
        await ev("(()=>{__dbg.standUp(); const v=__dbg.van,P=__dbg.P; v.local(-7,0,5,P.pos); P.pos.y=__dbg.world.walkH(P.pos.x,P.pos.z,50); P.onboard=false; P.yaw=v.heading+Math.PI/2+0.5; P.pitch=-0.1;})()")
        await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/p2_shadow.png')
        await ev("__dbg.teleport('bar')"); await pg.wait_for_timeout(400)
        await ev("__G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(9000)
        print('bar crowd face', await ev("[__G.leg, __dbg.world.crowdPos.length]"))
        await ev("__dbg.forceShot(4)"); await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/p2_bar.png')
        print(errs); await b.close()
asyncio.run(main())
