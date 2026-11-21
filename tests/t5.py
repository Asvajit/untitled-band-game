import asyncio
from playwright.async_api import async_playwright
BOT = """
(role)=>new Promise(res=>{
  __dbg.setupRole(role); __dbg.startPractice();
  const P=__G.perf; const km={drums:['KeyD','KeyF','KeyJ','KeyK'],bass:['KeyD','KeyF','KeyJ','KeyK'],trumpet:['KeyJ','KeyK','KeyL'],synth:['KeyA','KeyS','KeyD','KeyF','KeyG'],turntable:['KeyA','KeyD']}[role];
  if(role==='trumpet') P.keydown('Space');
  if(role==='vocals') P.keydown('Space');
  const done=new Set();
  const iv=setInterval(()=>{
    if(!__G.perf){clearInterval(iv); res(window.__last); return;}
    const now=P.audio.now; const arr=P.notes[role];
    for(const n of arr){ if(n.judged||done.has(n)) continue; if(n.t>now+0.03) break;
      if(role==='vocals'){ P.cursor=n.p; continue; }
      if(Math.abs(n.t-now)<0.04){ done.add(n); window.__np=(window.__np||0)+1; window.__lag=(window.__lag||[]); window.__lag.push(Math.round((now-n.t)*1000)); for(const l of n.lanes) P.keydown(km[l]); const hold = role==='bass' ? n.d*P.spb*1000 : 30; setTimeout(()=>{for(const l of n.lanes) P.keyup(km[l]); if(role==='trumpet'){P.keydown('Space');}}, hold); }
    }
    if(role==='trumpet' && P.breath<0.15){ P.keyup('Space'); setTimeout(()=>P.keydown('Space'),300); }
  },8);
})
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':200,'height':120})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/bandvan/dist/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("""(()=>{ const orig=__dbg; window.__last=null; })()""")
        await pg.evaluate("__dbg.teleport('venue')")
        # hook finish
        await pg.evaluate("""(()=>{ const t=setInterval(()=>{ if(__G.perf && !__G.perf.__h){ const P=__G.perf; P.__h=1; const o=P.onEvent; P.onEvent=(ty,d)=>{ if(ty==='finish') window.__last={acc:d.acc, stats:d.stats}; o(ty,d); }; } },5); })()""")
        for role in ['drums','trumpet']:
            r = await pg.evaluate(BOT, role)
            print(role, r, await pg.evaluate('[window.__np, JSON.stringify((window.__lag||[]).slice(0,30))]')); await pg.evaluate('window.__np=0; window.__lag=[]')
        print(errs)
        await b.close()
asyncio.run(main())
