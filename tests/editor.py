import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        ev=pg.evaluate
        print('default', await ev("[__dbg.world.length|0, __dbg.world.sBar|0, __dbg.world.sNF|0]"))
        await pg.screenshot(path='shots/e0_title.png')
        await pg.click('#goedit'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/e1_editor.png')
        print('warns', await ev("__dbg.editor._dbg.info.warns"))
        # zoom into the start and drag a road point with the mouse
        for _ in range(9): await pg.mouse.move(480, 650); await pg.mouse.wheel(0, -200)
        await pg.wait_for_timeout(200)
        before = await ev("JSON.stringify(__dbg.editor.level.road[3])")
        pt = await ev("(()=>{const c=document.getElementById('edcan'); return null})()")
        # find screen pos of road point 3 via a tiny helper: pick by scanning
        await pg.screenshot(path='shots/e2_zoom.png')
        # double click on road to add a point + drag it
        n0 = await ev("__dbg.editor.level.road.length")
        # programmatic edit: big detour in part 1, then play
        await ev("""(()=>{const e=__dbg.editor, L=JSON.parse(JSON.stringify(e.level)); L.road[6][0]+=120; L.road[7][0]+=160; L.road[8][0]+=120; L.blockers.push([L.road[2][0],L.road[2][1],'crates']); e._dbg.set(L);})()""")
        print('after edit warns', await ev("__dbg.editor._dbg.info.warns"), 'L', await ev("__dbg.editor._dbg.info.L|0"))
        await pg.screenshot(path='shots/e3_edited.png')
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('#edplay'); await pg.wait_for_timeout(1500)
        await pg.wait_for_function("document.getElementById('loading') && document.getElementById('loading').style.display==='none' && window.__dbg", timeout=180000)
        print('custom', await ev("[__dbg.world.length|0, __dbg.world.sBar|0, __dbg.world.sNF|0, __dbg.world.blockers.length]"), 'hash', (await ev("location.hash"))[:20])
        await pg.screenshot(path='shots/e4_custom_title.png')
        await pg.click('#go'); await pg.wait_for_timeout(600)
        r = await ev("""(()=>{const V=__dbg.van, w=__dbg.world, G=__G; __dbg.sit('driver'); V.engineOn=true; V.handbrake=false; V.setGear('1'); let g=1; const inp={throttle:1,brake:0,steer:0,clutch:false}; let maxOff=0;
              for(let i=0;i<60*500;i++){ const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+10); let d=Math.atan2(q.x-V.pos.x,q.z-V.pos.z)-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3)); inp.throttle=Math.abs(V.v)>14?0:1;
                 if(V.rpm>4800&&g<5){g++;V.setGear(String(g));} if(V.rpm<1500&&g>1){g--;V.setGear(String(g));}
                 for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
                 V.update(1/60,inp); __dbg.checkObjectives(); maxOff=Math.max(maxOff,n.d);
                 if(G.obj>=3) return {arrivedBar:i/60|0, maxOff:maxOff.toFixed(1)}; if(n.s>w.sBar+5){ return {passedBar:true, obj:G.obj}; } }
              return {stuck:w.nearestRoad(V.pos.x,V.pos.z).s|0};})()""")
        print('drive custom leg1', r)
        print(errs); await b.close()
asyncio.run(main())
