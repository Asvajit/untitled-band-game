import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        ev=pg.evaluate
        await pg.click('#goedit'); await pg.wait_for_timeout(500)
        for _ in range(8): await pg.mouse.move(490, 600); await pg.mouse.wheel(0, -200)
        await pg.wait_for_timeout(200)
        idx = await ev("(()=>{const e=__dbg.editor; for(let i=3;i<40;i++){const [x,y]=e._dbg.screen(e.level.road[i]); if(x>100&&x<800&&y>100&&y<600) return i;} return -1})()")
        x,y = await ev(f"__dbg.editor._dbg.screen(__dbg.editor.level.road[{idx}])"); print('idx',idx,x,y)
        b0 = await ev(f"JSON.stringify(__dbg.editor.level.road[{idx}])")
        await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+60,y-20,steps=5); await pg.mouse.up()
        print('drag', b0, '->', await ev(f"JSON.stringify(__dbg.editor.level.road[{idx}])"), 'sel:', await ev("document.getElementById('edsel').innerText"))
        # double-click mid-road to insert
        a = await ev("__dbg.editor._dbg.screen(__dbg.editor.level.road[9])"); c = await ev("__dbg.editor._dbg.screen(__dbg.editor.level.road[10])")
        n0 = await ev("__dbg.editor.level.road.length")
        mx,my = await ev("(()=>{const e=__dbg.editor,a=e.level.road[9],b=e.level.road[10]; return e._dbg.screen([(a[0]+b[0])/2,(a[1]+b[1])/2])})()")
        await pg.mouse.dblclick(mx,my); await pg.wait_for_timeout(200)
        print('insert', n0, '->', await ev("__dbg.editor.level.road.length"))
        await pg.keyboard.press('Delete'); print('delete ->', await ev("__dbg.editor.level.road.length"))
        # drag a venue away: expect warning
        x,y = await ev("__dbg.editor._dbg.screen(__dbg.editor.level.blockers[0])")
        await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+80,y-90,steps=5); await pg.mouse.up()
        print('blocker snapped', await ev("JSON.stringify(__dbg.editor.level.blockers[0])"))
        await ev("(()=>{const e=__dbg.editor,L=JSON.parse(JSON.stringify(e.level)); L.venues[0][0]-=150; e._dbg.set(L)})()")
        print('warn', await ev("__dbg.editor._dbg.info.warns"))
        await pg.click('#edundo'); await pg.click('#edcopy'); print('text len', await ev("document.getElementById('edtext').value.length"))
        await pg.screenshot(path='shots/e5.png')
        await pg.click('#edclose'); await pg.wait_for_timeout(200); print('overlay', await ev("__G.overlay"))
        print(errs); await b.close()
asyncio.run(main())
