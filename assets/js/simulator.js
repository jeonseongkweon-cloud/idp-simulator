
(() => {
  const $=s=>document.querySelector(s);
  const view=$("#simulatorView"),drone=$("#drone"),altEl=$("#alt"),spdEl=$("#spd"),hdgEl=$("#hdg"),scoreEl=$("#score"),timerEl=$("#timer"),batteryEl=$("#battery");
  const title=$("#missionTitle"),text=$("#missionText"),missionNo=$("#missionNo"),flash=$("#missionFlash"),warning=$("#warning");
  const wildfire=$("#wildfireZone"),target=$("#targetMarker"),hoverZone=$("#hoverZone");
  const rings=[$("#ring1"),$("#ring2"),$("#ring3")], missingPerson=$("#missingPerson"),coordBox=$("#coordBox"),nightBeacon=$("#nightBeacon");
  let x=50,y=65,rot=0,alt=0,score=0,flying=false,paused=false,start=0,timerId=null,stage=0,lastMove=0,mode="basic",battery=100,completeShown=false;
  let moveVX=0,moveVY=0,tiltX=0,tiltY=0,hold=0,ringIndex=0,searchFound=false,fireObserved=false;

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,(ay-by)*1.1);
  function nowTime(){const sec=Math.floor((Date.now()-start)/1000);return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
  function draw(){
    const scale=1+alt*.006;
    drone.style.left=x+"%";drone.style.top=y+"%";
    drone.style.transform=`translate(-50%,-50%) rotateZ(${rot}deg) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scale})`;
    drone.classList.toggle("flying",flying);drone.classList.toggle("fast",(Date.now()-lastMove<180));
    const shadow=drone.querySelector(".drone-shadow");shadow.style.transform=`scale(${clamp(1.2-alt*.025,.35,1.2)})`;shadow.style.opacity=clamp(1-alt*.025,.15,.8);
    altEl.textContent=alt.toFixed(1);spdEl.textContent=((Date.now()-lastMove<220&&flying)?Math.min(8,Math.hypot(moveVX,moveVY)*2.3+2.2):0).toFixed(1);
    hdgEl.textContent=String((Math.round(rot)%360+360)%360).padStart(3,"0");scoreEl.textContent=String(Math.max(0,Math.round(score))).padStart(4,"0");batteryEl.textContent=Math.max(0,Math.round(battery));
  }
  function flashComplete(label="MISSION COMPLETE"){flash.textContent=label;flash.classList.remove("show");void flash.offsetWidth;flash.classList.add("show");window.IDPTone?.(760,.22)}
  function warn(msg){warning.textContent=msg;warning.classList.remove("show");void warning.offsetWidth;warning.classList.add("show");window.IDPTone?.(145,.18,"square")}
  function addScore(v,label){score+=v;draw();if(label)flashComplete(`${label} +${v}`)}
  function resetEnv(){
    wildfire.classList.remove("show");target.classList.remove("show");hoverZone.classList.remove("show");
    rings.forEach(r=>{r.classList.remove("show","passed")});missingPerson.classList.remove("show");coordBox.classList.remove("show");nightBeacon.classList.remove("show");
    view.classList.remove("night-mode","search-mode");
  }
  function resetCommon(){
    x=50;y=65;rot=0;alt=0;score=0;flying=false;paused=false;start=Date.now();lastMove=0;battery=100;completeShown=false;moveVX=moveVY=tiltX=tiltY=0;hold=0;ringIndex=0;searchFound=false;fireObserved=false;resetEnv();draw();
  }

  const missionSets={
    basic:[
      ["MISSION 01","TAKE OFF","SPACE 키를 눌러 이륙하십시오."],
      ["MISSION 02","CLIMB TO 5m","↑ 키로 고도 5m까지 상승하십시오."],
      ["MISSION 03","FORWARD FLIGHT","W 키로 전진하십시오."],
      ["MISSION 04","RETURN & LAND","착륙장 H 근처로 복귀해 안전하게 착륙하십시오."]
    ],
    hover:[
      ["LEVEL 2 / 01","TAKE OFF","SPACE 키로 이륙하십시오."],
      ["LEVEL 2 / 02","CLIMB TO 6m","고도 6m까지 상승하십시오."],
      ["LEVEL 2 / 03","ENTER HOVER ZONE","중앙 HOVER ZONE 안으로 이동하십시오."],
      ["LEVEL 2 / 04","HOLD 10 SECONDS","조작을 최소화하고 10초 정지비행을 유지하십시오."],
      ["LEVEL 2 / 05","LAND","착륙장에 안전하게 착륙하십시오."]
    ],
    rings:[
      ["RING / 01","TAKE OFF","SPACE 키로 이륙하십시오."],
      ["RING / 02","PASS RING 1","첫 번째 링 중심을 통과하십시오."],
      ["RING / 03","PASS RING 2","두 번째 링을 통과하십시오."],
      ["RING / 04","PASS RING 3","세 번째 링을 통과하십시오."],
      ["RING / 05","RETURN & LAND","착륙장으로 복귀하십시오."]
    ],
    search:[
      ["SEARCH / 01","TAKE OFF","수색 임무를 시작하십시오."],
      ["SEARCH / 02","CLIMB TO 8m","수색 고도 8m를 확보하십시오."],
      ["SEARCH / 03","SEARCH AREA","화면 오른쪽 아래 수색구역을 탐색하십시오."],
      ["SEARCH / 04","TARGET FOUND","실종자를 확인했습니다. 3초간 위치를 유지하십시오."],
      ["SEARCH / 05","RETURN & LAND","안전하게 복귀하십시오."]
    ],
    wildfire:[
      ["FIRE / 01","TAKE OFF","산불 감시 비행을 시작하십시오."],
      ["FIRE / 02","CLIMB TO 8m","고도 8m를 확보하십시오."],
      ["FIRE / 03","FIND SMOKE","연기 발생 지역으로 접근하십시오."],
      ["FIRE / 04","CONFIRM & REPORT","산불 지점을 3초간 관측해 좌표를 확인하십시오."],
      ["FIRE / 05","RETURN SAFE","좌표 보고 후 착륙장으로 복귀하십시오."]
    ],
    night:[
      ["NIGHT / 01","TAKE OFF","야간 비행을 시작하십시오."],
      ["NIGHT / 02","CLIMB TO 5m","고도 5m를 확보하십시오."],
      ["NIGHT / 03","FIND BEACON","푸른 비콘 위치를 찾으십시오."],
      ["NIGHT / 04","HOLD POSITION","비콘 근처에서 3초간 정지비행하십시오."],
      ["NIGHT / 05","NIGHT LANDING","착륙장의 조명을 확인하고 안전하게 착륙하십시오."]
    ]
  };

  function setMission(i){
    stage=i;const m=missionSets[mode][i];missionNo.textContent=m[0];title.textContent=m[1];text.textContent=m[2];
  }
  function setupMode(){
    const labels={
      basic:["IDP / LEVEL 1","BASIC FLIGHT TRAINING"],
      hover:["IDP / LEVEL 2","HOVERING TEST"],
      rings:["IDP / OBSTACLE","RING COURSE"],
      search:["IDP / SEARCH","MISSING PERSON SEARCH"],
      wildfire:["IDP / WILDFIRE","COORDINATE REPORT MISSION"],
      night:["IDP / NIGHT OPS","LOW-LIGHT FLIGHT TRAINING"]
    };
    $("#modeTitle").textContent=labels[mode][0];$("#modeSubtitle").textContent=labels[mode][1];
    if(mode==="hover")hoverZone.classList.add("show");
    if(mode==="rings")rings.forEach(r=>r.classList.add("show"));
    if(mode==="search"){view.classList.add("search-mode");missingPerson.classList.add("show")}
    if(mode==="wildfire"){wildfire.classList.add("show");target.classList.add("show")}
    if(mode==="night"){view.classList.add("night-mode");nightBeacon.classList.add("show")}
  }
  function open(newMode){mode=newMode;view.classList.add("open");document.body.style.overflow="hidden";resetCommon();setupMode();setMission(0);clearInterval(timerId);timerId=setInterval(tick,250);window.IDPTone?.(450,.18)}
  function close(){view.classList.remove("open");document.body.style.overflow="";clearInterval(timerId)}
  function toggleFlight(){
    if(!flying){flying=true;alt=Math.max(1,alt);addScore(200,"TAKE OFF");setMission(1)}
    else{
      const nearPad=Math.abs(x-50)<8&&y>74;
      if(alt<=1.4&&nearPad){
        flying=false;alt=0;const err=Math.hypot(x-50,(y-82)*.7),bonus=Math.round(clamp(800-err*45,350,800));addScore(bonus,"LANDING");
        const last=missionSets[mode].length-1;if(stage===last||mode==="basic")finish(bonus)
      }else warn("착륙장 H 근처에서 고도를 1m 이하로 낮추세요");
    }draw();
  }
  function key(e){
    if(!view.classList.contains("open"))return;const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
    if(k==="r"){resetCommon();setupMode();setMission(0);return}
    if(k==="p"){paused=!paused;$("#pauseBtn").textContent=paused?"RESUME":"PAUSE";return}
    if(e.code==="Space"){if(!paused)toggleFlight();return}
    if(paused||!flying)return;
    const step=1.8;lastMove=Date.now();moveVX=moveVY=0;
    if(k==="w"){y-=step;moveVY=-1;tiltY=-12;if(mode==="basic"&&stage===2){addScore(250,"FORWARD");setMission(3)}}
    if(k==="s"){y+=step;moveVY=1;tiltY=12}
    if(k==="a"){x-=step;moveVX=-1;tiltX=-13}
    if(k==="d"){x+=step;moveVX=1;tiltX=13}
    if(e.key==="ArrowUp"){
      alt=clamp(alt+.5,0,30);y-=.25;
      if(mode==="basic"&&stage===1&&alt>=5){addScore(250,"ALTITUDE");setMission(2)}
      if(mode==="hover"&&stage===1&&alt>=6){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="search"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="wildfire"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="night"&&stage===1&&alt>=5){addScore(250,"ALTITUDE");setMission(2)}
      if(mode==="rings"&&stage===1&&alt>=4){setMission(1)}
    }
    if(e.key==="ArrowDown"){alt=clamp(alt-.5,0,30);y+=.25}
    if(e.key==="ArrowLeft")rot-=7;if(e.key==="ArrowRight")rot+=7;
    x=clamp(x,4,96);y=clamp(y,10,88);draw();setTimeout(()=>{tiltX*=.55;tiltY*=.55;draw()},120);
  }
  addEventListener("keydown",key,{passive:false});

  function tick(){
    timerEl.textContent=nowTime();if(paused)return;
    if(flying){battery=Math.max(0,battery-.018);if(battery<15&&Math.random()<.08)warn("LOW BATTERY")}
    if(mode==="hover"&&flying){
      const d=dist(x,y,50,54);
      if(stage===2&&d<8&&Math.abs(alt-6)<2){addScore(400,"ZONE ENTERED");setMission(3);hold=0}
      if(stage===3){
        const stable=d<8&&Math.abs(alt-6)<2&&(Date.now()-lastMove>350);
        if(stable){hold+=.25;text.textContent=`정지비행 유지 중... ${Math.min(10,hold).toFixed(1)} / 10.0초`;if(hold>=10){addScore(800,"HOVER PASS");setMission(4)}}
        else hold=Math.max(0,hold-.5)
      }
    }
    if(mode==="rings"&&flying){
      const pts=[[29,52],[57,42],[80,60]];
      if(stage>=1&&stage<=3){
        const idx=stage-1,d=dist(x,y,pts[idx][0],pts[idx][1]);
        if(d<7){rings[idx].classList.add("passed");addScore(450,`RING ${idx+1}`);setMission(stage+1)}
      }
    }
    if(mode==="search"&&flying){
      const d=dist(x,y,84,72);
      if(stage===2&&d<14){addScore(500,"PERSON FOUND");setMission(3);hold=0}
      if(stage===3){
        if(d<12){hold+=.25;text.textContent=`실종자 위치 확인 중... ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(650,"LOCATION CONFIRMED");setMission(4)}}
        else hold=0
      }
    }
    if(mode==="wildfire"&&flying){
      const d=dist(x,y,84,63);
      if(stage===2&&d<13){addScore(450,"SMOKE DETECTED");setMission(3);hold=0}
      if(stage===3){
        if(d<12){hold+=.25;text.textContent=`산불 지점 관측 중... ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){coordBox.classList.add("show");addScore(700,"COORDINATE REPORTED");setMission(4)}}
        else hold=0
      }
    }
    if(mode==="night"&&flying){
      const d=dist(x,y,72,56);
      if(stage===2&&d<12){addScore(450,"BEACON FOUND");setMission(3);hold=0}
      if(stage===3){
        if(d<10){hold+=.25;text.textContent=`비콘 정지비행... ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(550,"NIGHT HOLD");setMission(4)}}
        else hold=0
      }
    }
    draw();
  }

  function finish(landingBonus){
    if(completeShown)return;completeShown=true;const sec=Math.floor((Date.now()-start)/1000),timeBonus=Math.round(clamp(500-sec*4,100,500));score+=timeBonus;
    const maxByMode={basic:2000,hover:2200,rings:2500,search:2700,wildfire:2750,night:2500};
    const ratio=score/maxByMode[mode],stars=ratio>=.82?3:ratio>=.62?2:1;
    const titles={basic:"LEVEL 1 COMPLETE",hover:"LEVEL 2 HOVERING PASS",rings:"RING COURSE COMPLETE",search:"SEARCH MISSION COMPLETE",wildfire:"WILDFIRE REPORT COMPLETE",night:"NIGHT FLIGHT COMPLETE"};
    const messages={
      basic:"기초 비행과 정밀 착륙 훈련을 완료했습니다.",
      hover:"10초 정지비행과 착륙 시험을 완료했습니다.",
      rings:"장애물 링 3개를 통과하고 안전하게 복귀했습니다.",
      search:"실종자 위치를 확인하고 안전하게 복귀했습니다.",
      wildfire:"산불 좌표를 확인·보고하고 복귀했습니다.",
      night:"저조도 비콘 확인과 야간 착륙을 완료했습니다."
    };
    $("#completeTitle").textContent=titles[mode];$("#stars").textContent="★".repeat(stars)+"☆".repeat(3-stars);$("#finalScore").textContent=Math.round(score);$("#finalTime").textContent=nowTime();$("#landingQuality").textContent=landingBonus>=700?"S":landingBonus>=550?"A":"B";$("#completeMessage").textContent=messages[mode];
    setTimeout(()=>$("#completeModal").classList.add("open"),700);window.IDPTone?.(880,.4)
  }
  $("#exitSim").onclick=close;$("#pauseBtn").onclick=()=>{paused=!paused;$("#pauseBtn").textContent=paused?"RESUME":"PAUSE"};
  $("#retryBtn").onclick=()=>{$("#completeModal").classList.remove("open");open(mode)};$("#homeBtn").onclick=()=>{$("#completeModal").classList.remove("open");close()};
  window.IDPSim={open,close};
})();
