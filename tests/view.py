import asyncio, sys, json
from playwright.async_api import async_playwright
# usage: view.py name:leg:js-returning-[px,py,pz,tx,ty,tz] ...
SHOTS = {
 'falls1': (0, "(()=>{const w=__dbg.world,p=w.roadPoint(w.sFalls-18),f=w.falls; return [p.x,p.y+1.7,p.z,f.x,w.fallsY+11,f.z]})()"),
 'falls2': (0, "(()=>{const w=__dbg.world,f=w.falls,d=w.riverDir; return [f.x-d.x*34+d.z*10,w.fallsY+5,f.z-d.z*34-d.x*10,f.x,w.fallsY+11,f.z]})()"),
 'pass':   (0, "(()=>{const w=__dbg.world; return [330,150,380,0,40,580]})()"),
 'pass2':  (0, "(()=>{const w=__dbg.world,p=w.roadPoint(700),q=w.roadPoint(760); return [p.x,p.y+1.7,p.z,q.x,q.y+1,q.z]})()"),
 'van':    (0, "(()=>{const v=__dbg.van; const p=v.local(-3.6,1.5,4.4),c=v.local(0,1.1,0.3); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'vanr':   (0, "(()=>{const v=__dbg.van; const p=v.local(3.8,1.7,-4.6),c=v.local(0,1.1,-0.3); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'rv':     (1, "(()=>{const v=__dbg.van; const p=v.local(-6.5,2.4,8.5),c=v.local(0,1.7,0.5); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'rvr':    (1, "(()=>{const v=__dbg.van; const p=v.local(6,2.6,-9.5),c=v.local(0,1.7,-1); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'bus':    (2, "(()=>{const v=__dbg.van; const p=v.local(-7,2.4,10.5),c=v.local(0,1.7,1); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'busr':   (2, "(()=>{const v=__dbg.van; const p=v.local(-7,2.6,-10),c=v.local(0,1.7,-1); return [p.x,p.y,p.z,c.x,c.y,c.z]})()"),
 'crowd':  (2, "(()=>{const w=__dbg.world,s=w.venues[2].stage; return [s.x,s.top+7,s.z+2,s.x,s.top-6,s.z-50]})()"),
}
async def main():
    names = sys.argv[1:] or list(SHOTS)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        await pg.add_style_tag(content='#obj,#status,#toast,#help,#crosshair,#lockhint,#rolename,#dbgbtn,#prompt,#legend,#gearbox{display:none!important}')
        ev=pg.evaluate; leg=0
        for n in names:
            L,js = SHOTS[n]
            if L!=leg: await ev(f"__dbg.startLeg({L})"); leg=L; await pg.wait_for_timeout(300)
            if n=='crowd': await ev("__dbg.teleport('stadium')")
            await ev("__G.todOverride=0.3; __G.weather='clear'; __G.dbg.freecam=true")
            await ev(f"(()=>{{const a={js},fc=__dbg.fc; fc.pos.set(a[0],a[1],a[2]); __dbg.P.pos.set(a[0],-80,a[2]); const dx=a[3]-a[0],dy=a[4]-a[1],dz=a[5]-a[2]; fc.yaw=Math.atan2(dx,dz); fc.pitch=Math.atan2(dy,Math.hypot(dx,dz));}})()")
            await pg.wait_for_timeout(1200); await pg.screenshot(path=f'shots/v_{n}.png')
        print(errs); await b.close()
asyncio.run(main())
