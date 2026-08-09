
(() => {
  const view=document.getElementById("simulatorView");
  const drone=document.getElementById("drone");
  const altEl=document.getElementById("alt"), spdEl=document.getElementById("spd"), scoreEl=document.getElementById("score"), timerEl=document.getElementById("timer");
  const title=document.getElementById("missionTitle"), text=document.getElementById("missionText"), flash=document.getElementById("missionFlash");
  let x=50,y=68,rot=0,alt=0,score=0,flying=false,paused=false,start=0,timerId=null,stage=0,lastMove=0;

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function draw(){
    drone.style.left=x+"%";drone.style.top=y+"%";drone.style.transform=`translate(-50%,-50%) rotate(${rot}deg) scale(${1+alt*.008})`;
    drone.classList.toggle("flying",flying);
    altEl.textContent=alt.toFixed(1);
    spdEl.textContent=((Date.now()-lastMove<180 && flying)?3.2:0).toFixed(1);
    scoreEl.textContent=String(score).padStart(4,"0");
  }
  function setMission(i){
    stage=i;
    const missions=[
      ["TAKE OFF","SPACE 키를 눌러 이륙하십시오."],
      ["CLIMB TO 5m","↑ 키로 고도 5m 이상 상승하십시오."],
      ["MOVE FORWARD","W 키로 전진하십시오."],
      ["RETURN & LAND","착륙장으로 이동한 뒤 SPACE 키로 착륙하십시오."]
    ];
    title.textContent=missions[i][0]; text.textContent=missions[i][1];
  }
  function complete(points=250){
    score+=points;flash.classList.remove("show");void flash.offsetWidth;flash.classList.add("show");window.IDPTone?.(760,.22);
  }
  function reset(){
    x=50;y=68;rot=0;alt=0;score=0;flying=false;paused=false;start=Date.now();lastMove=0;setMission(0);draw();
  }
  function toggleFlight(){
    if(!flying){flying=true;alt=Math.max(1,alt);complete(200);setMission(1)}
    else if(alt<=1.3 && Math.abs(x-50)<8 && y>62){flying=false;alt=0;complete(500);setMission(0)}
    else{text.textContent="착륙장 근처에서 고도를 낮춘 후 착륙하십시오.";window.IDPTone?.(150,.15,"square")}
    draw();
  }
  function key(e){
    if(!view.classList.contains("open"))return;
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.key===" ")e.preventDefault();
    if(k==="f"){document.documentElement.requestFullscreen?.();return}
    if(k==="p"){paused=!paused;return}
    if(k==="r"){reset();return}
    if(paused)return;
    if(e.code==="Space"){toggleFlight();return}
    if(!flying)return;
    const step=1.6;lastMove=Date.now();
    if(k==="w"){y-=step;if(stage===2){complete(250);setMission(3)}}
    if(k==="s")y+=step;
    if(k==="a")x-=step;
    if(k==="d")x+=step;
    if(e.key==="ArrowUp"){alt=clamp(alt+.5,0,30);y-=.35;if(stage===1&&alt>=5){complete(250);setMission(2)}}
    if(e.key==="ArrowDown"){alt=clamp(alt-.5,0,30);y+=.35}
    if(e.key==="ArrowLeft")rot-=6;
    if(e.key==="ArrowRight")rot+=6;
    x=clamp(x,5,95);y=clamp(y,10,88);draw();
  }
  addEventListener("keydown",key,{passive:false});
  document.getElementById("exitSim").onclick=()=>api.close();
  document.getElementById("pauseBtn").onclick=()=>{paused=!paused;document.getElementById("pauseBtn").textContent=paused?"RESUME":"PAUSE"};
  function tick(){
    const sec=Math.floor((Date.now()-start)/1000),m=String(Math.floor(sec/60)).padStart(2,"0"),s=String(sec%60).padStart(2,"0");
    timerEl.textContent=`${m}:${s}`;
  }
  const api={
    open(){view.classList.add("open");view.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";reset();clearInterval(timerId);timerId=setInterval(tick,500);window.IDPTone?.(450,.18)},
    close(){view.classList.remove("open");view.setAttribute("aria-hidden","true");document.body.style.overflow="";clearInterval(timerId)}
  };
  window.IDPSim=api;
})();
