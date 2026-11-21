import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""(()=>{const V=__dbg.van, w=__dbg.world, G=__G; __dbg.sit('driver'); V.engineOn=true; V.handbrake=false; V.rpm=900; V.setGear('1'); let g=1; const log=[];
              const inp={throttle:1,brake:0,steer:0,clutch:false}; const n0=__dbg.toastLog.length;
              for(let i=0;i<60*700;i++){
                 G.t+=1/60;
                 const n=w.nearestRoad(V.pos.x,V.pos.z); const q=w.roadPoint(n.s+12); let d=Math.atan2(q.x-V.pos.x,q.z-V.pos.z)-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3));
                 inp.throttle = Math.abs(V.v)>15?0:1;
                 if(V.rpm>4800 && g<5){g++; V.setGear(String(g));} if(V.rpm<1500&&g>1){g--;V.setGear(String(g));}
                 for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
                 V.update(1/60,inp); __dbg.checkObjectives();
                 if(i%1200===0) log.push([n.s|0, Math.round(V.v*3.6), G.obj]);
                 if(n.s>w.length-60){log.push('END');break;}
              } return {log, toasts:__dbg.toastLog.slice(n0)};})()""")
        print(r['log']); 
        for t in r['toasts']: print(t)
        print(errs)
        await b.close()
asyncio.run(main())
