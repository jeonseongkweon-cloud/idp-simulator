
(() => {
  const $=s=>document.querySelector(s);
  const view=$("#simulatorView"),drone=$("#drone"),altEl=$("#alt"),spdEl=$("#spd"),hdgEl=$("#hdg"),scoreEl=$("#score"),timerEl=$("#timer"),batteryEl=$("#battery");
  const title=$("#missionTitle"),text=$("#missionText"),missionNo=$("#missionNo"),flash=$("#missionFlash"),warning=$("#warning"),wildfire=$("#wildfireZone"),target=$("#targetMarker");
  let x=50,y=65,rot=0,alt=0,score=0,flying=false,paused=false,start=0,timerId=null,stage=0,lastMove=0,mode="basic",battery=100,completeShown=false,moveVX=0,moveVY=0,tiltX=0,tiltY=0;

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function nowTime(){const sec=Math.floor((Date.now()-start)/1000);return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
  function draw(){
    const scale=1+alt*.006;
    drone.style.left=x+"%"; drone.style.top=y+"%";
    drone.style.transform=`translate(-50%,-50%) rotateZ(${rot}deg) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scale})`;
    drone.classList.toggle("flying",flying); drone.classList.toggle("fast",(Date.now()-lastMove<180));
    const shadow=drone.querySelector(".drone-shadow");
    shadow.style.transform=`scale(${clamp(1.2-alt*.025,.35,1.2)})`;
    shadow.style.opacity=clamp(1-alt*.025,.15,.8);
    altEl.textContent=alt.toFixed(1);
    spdEl.textContent=((Date.now()-lastMove<220&&flying)?Math.min(8,Math.hypot(moveVX,moveVY)*2.3+2.2):0).toFixed(1);
    hdgEl.textContent=String((Math.round(rot)%360+360)%360).padStart(3,"0");
    scoreEl.textContent=String(Math.max(0,Math.round(score))).padStart(4,"0");
    batteryEl.textContent=Math.max(0,Math.round(battery));
  }
  function flashComplete(label="MISSION COMPLETE"){flash.textContent=label;flash.classList.remove("show");void flash.offsetWidth;flash.classList.add("show");window.IDPTone?.(760,.22)}
  function warn(msg){warning.textContent=msg;warning.classList.remove("show");void warning.offsetWidth;warning.classList.add("show");window.IDPTone?.(145,.18,"square")}
  function addScore(v,label){score+=v;draw();if(label)flashComplete(`${label} +${v}`)}
  function resetCommon(){
    x=50;y=65;rot=0;alt=0;score=0;flying=false;paused=false;start=Date.now();lastMove=0;battery=100;completeShown=false;moveVX=moveVY=tiltX=tiltY=0;wildfire.classList.remove("show");target.classList.remove("show");draw();
  }
  const basicMissions=[
    ["MISSION 01","TAKE OFF","SPACE 키를 눌러 이륙하십시오."],
    ["MISSION 02","CLIMB TO 5m","↑ 키로 고도 5m까지 상승하십시오."],
    ["MISSION 03","FORWARD FLIGHT","W 키로 전진하여 비행 감각을 익히십시오."],
    ["MISSION 04","RETURN & LAND","착륙장 H 근처로 이동하고 고도를 낮춘 뒤 SPACE로 착륙하십시오."]
  ];
  const fireMissions=[
    ["MISSION F1","TAKE OFF","SPACE 키를 눌러 감시 비행을 시작하십시오."],
    ["MISSION F2","CLIMB TO 8m","↑ 키로 고도 8m까지 상승하십시오."],
    ["MISSION F3","FIND SMOKE","오른쪽 산불 구역으로 접근하십시오."],
    ["MISSION F4","HOLD POSITION","산불 지점 가까이에서 3초간 관측하십시오."],
    ["MISSION F5","RETURN SAFE","착륙장으로 복귀하여 안전하게 착륙하십시오."]
  ];
  function setMission(i){
    stage=i;const m=(mode==="wildfire"?fireMissions:basicMissions)[i];missionNo.textContent=m[0];title.textContent=m[1];text.textContent=m[2];
  }
  function open(newMode){
    mode=newMode;view.classList.add("open");document.body.style.overflow="hidden";resetCommon();
    $("#modeTitle").textContent=mode==="wildfire"?"IDP / WILDFIRE MISSION":"IDP / LEVEL 1";
    $("#modeSubtitle").textContent=mode==="wildfire"?"DISASTER WATCH TRAINING":"BASIC FLIGHT TRAINING";
    if(mode==="wildfire"){wildfire.classList.add("show");target.classList.add("show")}setMission(0);
    clearInterval(timerId);timerId=setInterval(tick,250);window.IDPTone?.(450,.18)
  }
  function close(){view.classList.remove("open");document.body.style.overflow="";clearInterval(timerId)}
  function toggleFlight(){
    if(!flying){
      flying=true;alt=Math.max(1,alt);addScore(200,"TAKE OFF");
      setMission(1);
    }else{
      const nearPad=Math.abs(x-50)<8 && y>74;
      if(alt<=1.4 && nearPad){
        flying=false;alt=0;
        const landingError=Math.hypot(x-50,(y-82)*.7);
        const landingBonus=Math.round(clamp(800-landingError*45,350,800));
        addScore(landingBonus,"LANDING");
        if(mode==="basic" || (mode==="wildfire" && stage===4))finish(landingBonus);
      }else warn("착륙장 H 근처에서 고도를 1m 이하로 낮추세요");
    }draw();
  }
  let fireHold=0;
  function key(e){
    if(!view.classList.contains("open"))return;
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
    if(k==="r"){resetCommon();if(mode==="wildfire"){wildfire.classList.add("show");target.classList.add("show")}setMission(0);return}
    if(k==="p"){paused=!paused;$("#pauseBtn").textContent=paused?"RESUME":"PAUSE";return}
    if(e.code==="Space"){if(!paused)toggleFlight();return}
    if(paused||!flying)return;
    const step=1.8;lastMove=Date.now();moveVX=moveVY=0;
    if(k==="w"){y-=step;moveVY=-1;tiltY=-12;if(mode==="basic"&&stage===2){addScore(250,"FORWARD");setMission(3)}}
    if(k==="s"){y+=step;moveVY=1;tiltY=12}
    if(k==="a"){x-=step;moveVX=-1;tiltX=-13}
    if(k==="d"){x+=step;moveVX=1;tiltX=13}
    if(e.key==="ArrowUp"){alt=clamp(alt+.5,0,30);y-=.25;if(mode==="basic"&&stage===1&&alt>=5){addScore(250,"ALTITUDE");setMission(2)}if(mode==="wildfire"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}}
    if(e.key==="ArrowDown"){alt=clamp(alt-.5,0,30);y+=.25}
    if(e.key==="ArrowLeft")rot-=7;
    if(e.key==="ArrowRight")rot+=7;
    x=clamp(x,4,96);y=clamp(y,10,88);draw();
    setTimeout(()=>{tiltX*=.55;tiltY*=.55;draw()},120);
  }
  addEventListener("keydown",key,{passive:false});

  function tick(){
    timerEl.textContent=nowTime();
    if(paused)return;
    if(flying){battery=Math.max(0,battery-.018); if(battery<15 && Math.random()<.08)warn("LOW BATTERY");}
    if(mode==="wildfire"&&flying){
      const dist=Math.hypot(x-84,(y-63)*1.1);
      if(stage===2 && dist<13){addScore(450,"SMOKE DETECTED");setMission(3);fireHold=0}
      if(stage===3 && dist<12){
        fireHold+=.25;
        text.textContent=`산불 지점 관측 중... ${Math.min(3,fireHold).toFixed(1)} / 3.0초`;
        if(fireHold>=3){addScore(650,"FIRE CONFIRMED");setMission(4)}
      } else if(stage===3){fireHold=0}
    }
    draw();
  }

  function finish(landingBonus){
    if(completeShown)return;completeShown=true;
    const seconds=Math.floor((Date.now()-start)/1000);
    const timeBonus=Math.round(clamp(500-seconds*4,100,500));
    score+=timeBonus;
    const maxScore=mode==="wildfire"?2800:2000;
    const ratio=score/maxScore;
    const stars=ratio>=.82?3:ratio>=.62?2:1;
    $("#completeTitle").textContent=mode==="wildfire"?"WILDFIRE MISSION COMPLETE":"LEVEL 1 COMPLETE";
    $("#stars").textContent="★".repeat(stars)+"☆".repeat(3-stars);
    $("#finalScore").textContent=Math.round(score);
    $("#finalTime").textContent=nowTime();
    $("#landingQuality").textContent=landingBonus>=700?"S":landingBonus>=550?"A":"B";
    $("#completeMessage").textContent=mode==="wildfire"?"산불 감시·현장 관측·안전 복귀 훈련을 완료했습니다.":"기초 비행과 정밀 착륙 훈련을 완료했습니다.";
    setTimeout(()=>$("#completeModal").classList.add("open"),700);window.IDPTone?.(880,.4)
  }
  $("#exitSim").onclick=close;$("#pauseBtn").onclick=()=>{paused=!paused;$("#pauseBtn").textContent=paused?"RESUME":"PAUSE"};
  $("#retryBtn").onclick=()=>{$("#completeModal").classList.remove("open");open(mode)};
  $("#homeBtn").onclick=()=>{$("#completeModal").classList.remove("open");close()};
  window.IDPSim={open,close};
})();
