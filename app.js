(() => {
  const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
  const $ = id => document.getElementById(id);
  let ws = null, paused = false, ticksSeen = 0, symbols = [], states = new Map(), alerts = [];
  const MAX_HISTORY = 160, MAX_ALERTS = 30;
  const fmt = n => Number(n).toLocaleString(undefined,{maximumFractionDigits:6});
  const setConnection = (label, live=false) => {
    $("connection").innerHTML = `<span class="dot ${live?'live':''}"></span>${label}`;
    $("feedstatus").textContent = `Feed: ${label.toLowerCase()}`;
  };
  function send(obj){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
  function connect(){
    if(ws && (ws.readyState===0 || ws.readyState===1)) ws.close();
    setConnection("Connecting");
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { setConnection("Connected",true); $("pause").disabled=false; send({active_symbols:"brief", product_type:"basic", req_id:1}); };
    ws.onmessage = ev => {
      let d; try{d=JSON.parse(ev.data)}catch{return}
      if(d.error){setConnection("Feed error");return}
      if(d.msg_type==="active_symbols"){
        const found=(d.active_symbols||[]).filter(s=>/boom|crash/i.test((s.display_name||"")+" "+(s.symbol||"")));
        symbols=found;
        $("symbolcount").textContent=`Indices: ${symbols.length}`;
        symbols.forEach(s=>{if(!states.has(s.symbol)) states.set(s.symbol,{name:s.display_name||s.symbol,prices:[],last: null,status:"NORMAL",score:0,lastAlert:0});});
        render();
        symbols.forEach((s,i)=>setTimeout(()=>send({ticks:s.symbol,subscribe:1,req_id:100+i}),i*120));
      }
      if(d.msg_type==="tick" && d.tick){
        const sym=d.tick.symbol, st=states.get(sym); if(!st)return;
        const p=Number(d.tick.quote), t=Number(d.tick.epoch);
        if(!Number.isFinite(p))return;
        ticksSeen++; $("tickcount").textContent=`Ticks: ${ticksSeen}`;
        if(st.last!==null){
          const delta=p-st.last, abs=Math.abs(delta);
          const hist=st.prices;
          const sample=hist.slice(-80).map(x=>Math.abs(x.delta)).filter(x=>x>0);
          const sorted=[...sample].sort((a,b)=>a-b);
          const median=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
          const ratio=median>0?abs/median:0;
          // Conservative anomaly score: compares the latest tick move with this symbol's own recent tick-size baseline.
          st.score=Math.min(99,Math.round((ratio/8)*100));
          if(sample.length>=25 && ratio>=4 && t-st.lastAlert>=90){
            st.status=ratio>=7?"HIGH ALERT":"WATCH";
            st.lastAlert=t;
            addAlert(st.name,sym,p,delta,ratio,t);
          } else if(st.status!=="NORMAL" && t-st.lastAlert>180) st.status="NORMAL";
          hist.push({price:p,delta,time:t}); if(hist.length>MAX_HISTORY)hist.shift();
        } else st.prices.push({price:p,delta:0,time:t});
        st.last=p; renderMarket(sym);
      }
    };
    ws.onerror=()=>setConnection("Connection error");
    ws.onclose=()=>{setConnection("Disconnected");};
  }
  function render(){
    $("markets").innerHTML="";
    if(!symbols.length){$("markets").innerHTML='<div class="card"><div class="detail">No Boom or Crash symbols were returned. Check the connection and try again.</div></div>';return}
    symbols.forEach(s=>{
      const st=states.get(s.symbol);
      const card=document.createElement("div");card.className="card";card.id="card-"+s.symbol;
      card.innerHTML=cardHTML(st,s.symbol);$("markets").appendChild(card);
    });
  }
  function cardHTML(st,sym){
    const cls=st.status==="HIGH ALERT"?"state-high":st.status==="WATCH"?"state-watch":"state-normal";
    return `<div class="cardtop"><div class="symbol">${escapeHTML(st.name)}</div><span class="tag ${cls}">${st.status}</span></div><div class="price">${st.last===null?"—":fmt(st.last)}</div><div class="detail">Move score: ${st.score}% · ${st.prices.length} ticks stored locally</div>`;
  }
  function renderMarket(sym){const el=$("card-"+sym);const st=states.get(sym);if(el&&st)el.innerHTML=cardHTML(st,sym);}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function addAlert(name,sym,price,delta,ratio,time){
    const direction=delta>0?"UPWARD MOVE":"DOWNWARD MOVE";
    const item={name,sym,price,direction,ratio,time};alerts.unshift(item);alerts=alerts.slice(0,MAX_ALERTS);
    $("alertcount").textContent=`${alerts.length} alerts`;
    $("alerts").innerHTML=alerts.map(a=>`<div class="alert"><div><b>${escapeHTML(a.name)} · ${a.direction}</b><small>Unusual tick movement · ${new Date(a.time*1000).toLocaleTimeString()}</small></div><div style="text-align:right">${fmt(a.price)}<small>${a.ratio.toFixed(1)}× baseline</small></div></div>`).join("");
    if("Notification" in window && Notification.permission==="granted"){
      navigator.serviceWorker?.ready.then(reg=>reg.showNotification(`Spike Radar: ${name}`,{
        body:`Unusual ${direction.toLowerCase()} detected. Review the chart; this is not a trade instruction.`,
        icon:"./icon.svg", tag:`${sym}-spike-alert`
      })).catch(()=>{});
    }
  }
  $("connect").addEventListener("click",connect);
  $("notify").addEventListener("click",async()=>{
    if(!("Notification" in window)){alert("This browser does not support notifications.");return}
    const p=await Notification.requestPermission();
    $("notify").textContent=p==="granted"?"Phone alerts enabled": "Enable phone alerts";
    if(p==="granted") navigator.serviceWorker?.ready.then(reg=>reg.showNotification("Spike Radar alerts enabled",{
      body:"You can receive alerts while this app is active.",icon:"./icon.svg"
    })).catch(()=>{});
  });
  $("pause").addEventListener("click",()=>{
    paused=!paused;$("pause").textContent=paused?"Resume scan":"Pause scan";
    if(paused){send({forget_all:"ticks"});setConnection("Paused")}else connect();
  });
  if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();