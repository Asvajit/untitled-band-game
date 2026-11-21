import asyncio, sys
from playwright.async_api import async_playwright
AUTO = """(cap)=>{const V=__dbg.van, w=__dbg.world, G=__G; __dbg.sit('driver'); V.fuel=100; V.engineOn=true; V.handbrake=false; V.rpm=900; V.setGear('1'); let g=1; let maxOff=0, top=0, slips=0; const log=[];
  const inp={throttle:1,brake:0,steer:0,clutch:false,grip:1}; const end=w.legRange[G.leg][1];
  const hd=(s)=>{const p=w.roadPoint(s); return Math.atan2(p.tx,p.tz)};
  for(let i=0;i<60*900;i++){ G.t+=1/60;
    const n=w.nearestRoad(V.pos.x,V.pos.z); const look=6+Math.abs(V.v)*0.7; const q=w.roadPoint(n.s+look); let d=Math.atan2(q.x-V.pos.x,q.z-V.pos.z)-V.heading; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; inp.steer=Math.max(-1,Math.min(1,d*3.5));
    let vmax=cap; for(const a of [10,25,45]){ let dh=hd(n.s+a+8)-hd(n.s+a-8); while(dh>Math.PI)dh-=2*Math.PI; while(dh<-Math.PI)dh+=2*Math.PI; const R=16/Math.max(1e-3,Math.abs(dh)); const vc=Math.sqrt(V.spec.grip*0.6*R); const vAllowed=Math.sqrt(vc*vc+2*5*a); vmax=Math.min(vmax,vAllowed);} 
    inp.throttle=V.v<vmax-0.5?1:0; inp.brake=V.v>vmax+1?0.7:0;
    if(V.rpm>4600&&g<5){g++;V.setGear(String(g));} if(V.rpm<1700&&g>1){g--;V.setGear(String(g));} if(V.gear==='N'){g=1;V.setGear('1');}
    for(const bk of w.blockers) if(Math.hypot(bk.g.position.x-V.pos.x,bk.g.position.z-V.pos.z)<40) w.clearBlocker(bk);
    V.update(1/60,inp); __dbg.checkObjectives(); maxOff=Math.max(maxOff,n.d); top=Math.max(top,V.v); if(V.slip>0)slips++;
    if(i%1800===0) log.push([n.s|0, Math.round(V.v*3.6), V.gear, +V.y.toFixed(0)]);
    if(G.obj>=3 || n.s>end-25) return {ok:true, secs:i/60|0, maxOff:+maxOff.toFixed(1), topKmh:Math.round(top*3.6), slipFrames:slips, log};
  } return {ok:false, at:w.nearestRoad(V.pos.x,V.pos.z).s|0, maxOff, log};}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(500)
        ev=pg.evaluate
        print(await ev("""(()=>{const w=__dbg.world; let mg=0,at=0; for(let i=1;i<=w.N;i++){const g=Math.abs(w.ry[i]-w.ry[i-1])/w.step; if(g>mg){mg=g;at=i*w.step|0;}}
          let worst=1e9; for(let i=0;i<=w.N;i+=3)for(let j=i+60;j<=w.N;j+=3){const d=Math.hypot(w.rx[i]-w.rx[j],w.rz[i]-w.rz[j]); if(d<worst)worst=d;}
          let hi=-1e9,hs=0; for(let i=0;i<=w.N;i++) if(w.ry[i]>hi){hi=w.ry[i];hs=i*w.step|0;}
          return {L:w.length|0,sBar:w.sBar|0,sNF:w.sNF|0,maxGrade:+mg.toFixed(3),at,selfMin:worst|0,summit:[hi|0,hs],y0:w.ry[0]|0,yBar:w.roadYAt(w.sBar)|0, falls:w.sFalls|0};})()"""))
        for leg in ([0,1,2] if len(sys.argv)<2 else [int(sys.argv[1])]):
            if leg: await ev(f"__dbg.startLeg({leg})"); await pg.wait_for_timeout(300)
            print('LEG',leg+1, await ev(f"({AUTO})(40)"))
        print(errs); await b.close()
asyncio.run(main())
