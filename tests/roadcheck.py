import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        r = await pg.evaluate("""(()=>{const w=__dbg.world; let worst=1e9, at=null; for(let i=0;i<=w.N;i+=3)for(let j=i+60;j<=w.N;j+=3){const d=Math.hypot(w.rx[i]-w.rx[j],w.rz[i]-w.rz[j]); if(d<worst){worst=d;at=[i*w.step|0,j*w.step|0];}}
          const fr=w.nearestRoad(w.falls.x,w.falls.z).d; const st=w.studios.map(s=>w.nearestRoad(s.center.x,s.center.z).d|0);
          let maxCurv=0; for(let i=5;i<w.N-5;i++){const a=Math.atan2(w.tx[i-5],w.tz[i-5]),b=Math.atan2(w.tx[i+5],w.tz[i+5]); let d=Math.abs(b-a); if(d>Math.PI)d=2*Math.PI-d; maxCurv=Math.max(maxCurv,d/20);}
          return {L:w.length|0, sBar:w.sBar|0, sNF:w.sNF|0, selfMin:worst|0, at, fallsToRoad:fr|0, studios:st, minRadius:(1/maxCurv)|0};})()""")
        print(r, errs)
        await b.close()
asyncio.run(main())
