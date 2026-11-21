import asyncio
from playwright.async_api import async_playwright
MEAS = """async (label)=>{
 const a=window.__au; const ctx=a.ctx;
 if(!window.__an){ const an=ctx.createAnalyser(); an.fftSize=4096; a.master.connect(an); window.__an=an; }
 const an=window.__an; const buf=new Float32Array(an.frequencyBinCount);
 let acc=new Float32Array(an.frequencyBinCount);
 for(let k=0;k<20;k++){ await new Promise(r=>setTimeout(r,60)); an.getFloatFrequencyData(buf); for(let i=0;i<buf.length;i++) acc[i]+=Math.pow(10,buf[i]/10)/20; }
 const bin=ctx.sampleRate/an.fftSize; const band=(lo,hi)=>{let s=0; for(let i=Math.floor(lo/bin);i<Math.floor(hi/bin);i++) s+=acc[i]; return (10*Math.log10(s+1e-20)).toFixed(1);};
 return label+'  0-200:'+band(20,200)+' 200-2k:'+band(200,2000)+' 2k-8k:'+band(2000,8000)+' 8k+:'+band(8000,20000);
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':480,'height':270})
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=90000)
        await pg.evaluate("document.getElementById('go').click()"); await pg.wait_for_timeout(2500)
        ev=pg.evaluate
        print(await ev(MEAS,'idle start'))
        await ev("__dbg.teleport('venue'); __G.dbg.autoplay=true; __dbg.startGig()"); await pg.wait_for_timeout(6000)
        print(await ev(MEAS,'gig full mix'))
        await ev("__G.perf.out.gain.value=0"); await pg.wait_for_timeout(500)
        print(await ev(MEAS,'gig stems muted'))
        await ev("__au.eGain.disconnect()"); await pg.wait_for_timeout(300)
        print(await ev(MEAS,'+engine cut'))
        await ev("__au.wGain.disconnect()"); await pg.wait_for_timeout(300)
        print(await ev(MEAS,'+wind cut'))
        await ev("__au.verb.disconnect()"); await pg.wait_for_timeout(300)
        print(await ev(MEAS,'+reverb cut'))
        await b.close()
asyncio.run(main())
