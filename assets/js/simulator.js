
(() => {
  const $=s=>document.querySelector(s);
  const view=$("#simulatorView"),drone=$("#drone"),flightArea=$("#flightArea"),speedLines=$("#speedLines"),rpmText=$("#rpmText"),altEl=$("#alt"),spdEl=$("#spd"),hdgEl=$("#hdg"),scoreEl=$("#score"),timerEl=$("#timer"),batteryEl=$("#battery");
  const title=$("#missionTitle"),text=$("#missionText"),missionNo=$("#missionNo"),flash=$("#missionFlash"),warning=$("#warning");
  const wildfire=$("#wildfireZone"),target=$("#targetMarker"),hoverZone=$("#hoverZone");
  const rings=[$("#ring1"),$("#ring2"),$("#ring3")], missingPerson=$("#missingPerson"),coordBox=$("#coordBox"),nightBeacon=$("#nightBeacon");
  let x=50,y=65,rot=0,alt=0,score=0,flying=false,paused=false,start=0,timerId=null,stage=0,lastMove=0,mode="basic",battery=100,completeShown=false;
  let moveVX=0,moveVY=0,tiltX=0,tiltY=0,hold=0,ringIndex=0,searchFound=false,fireObserved=false,currentLevel=1, motorCtx=null,motorOsc=null,motorGain=null,motorFilter=null,motorLevel=0; const modeLevel={basic:1,hover:2,rings:3,search:4,wildfire:5,night:6,disaster:7,patrol:8,rescue:9,master:10}; const disasterMarker=$("#disasterMarker"), patrolPoints=[$("#patrolPoint1"),$("#patrolPoint2"),$("#patrolPoint3")], masterCore=$("#masterCore");


  function initMotorAudio(){
    try{
      motorCtx ||= new (window.AudioContext||window.webkitAudioContext)();
      if(motorCtx.state==="suspended")motorCtx.resume();
      if(!motorOsc){
        motorOsc=motorCtx.createOscillator();motorGain=motorCtx.createGain();motorFilter=motorCtx.createBiquadFilter();
        motorOsc.type="sawtooth";motorOsc.frequency.value=70;motorFilter.type="lowpass";motorFilter.frequency.value=850;
        motorGain.gain.value=.0001;motorOsc.connect(motorFilter);motorFilter.connect(motorGain);motorGain.connect(motorCtx.destination);motorOsc.start();
      }
    }catch(e){}
  }
  function setMotor(level,boost=0){
    motorLevel=clamp(level,0,1);initMotorAudio();
    if(motorOsc&&motorGain){
      const t=motorCtx.currentTime;
      const freq=70+motorLevel*115+boost*28;
      motorOsc.frequency.cancelScheduledValues(t);motorOsc.frequency.linearRampToValueAtTime(freq,t+.08);
      motorGain.gain.cancelScheduledValues(t);motorGain.gain.linearRampToValueAtTime(.004+motorLevel*.026,t+.08);
      motorFilter.frequency.linearRampToValueAtTime(700+motorLevel*1500,t+.08);
    }
    if(rpmText)rpmText.textContent=motorLevel<.05?"IDLE":`${Math.round(1800+motorLevel*7200)} RPM`;
  }
  function motorOff(){
    if(motorGain&&motorCtx){const t=motorCtx.currentTime;motorGain.gain.cancelScheduledValues(t);motorGain.gain.linearRampToValueAtTime(.0001,t+.5)}
    if(rpmText)rpmText.textContent="IDLE";
  }
  function impactTone(freq=105,dur=.13){window.IDPTone?.(freq,dur,"square")}

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,(ay-by)*1.1);
  function nowTime(){const sec=Math.floor((Date.now()-start)/1000);return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
  function draw(){
    const scale=1+alt*.008;
    const activeMove=(Date.now()-lastMove<240)&&flying;
    drone.style.left=x+"%";drone.style.top=y+"%";
    drone.style.transform=`translate(-50%,-50%) rotateZ(${rot}deg) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scale})`;
    drone.classList.toggle("flying",flying);drone.classList.toggle("fast",activeMove);
    drone.classList.toggle("idle-wobble",flying&&!activeMove);
    flightArea.classList.toggle("speeding",activeMove&&Math.hypot(moveVX,moveVY)>0);
    speedLines.classList.toggle("active",activeMove&&Math.hypot(moveVX,moveVY)>0);
    const shadow=drone.querySelector(".drone-shadow");shadow.style.transform=`scale(${clamp(1.35-alt*.028,.28,1.35)})`;shadow.style.opacity=clamp(.82-alt*.025,.12,.82);shadow.style.filter=`blur(${clamp(5+alt*.38,5,18)}px)`;
    altEl.textContent=alt.toFixed(1);spdEl.textContent=((Date.now()-lastMove<220&&flying)?Math.min(8,Math.hypot(moveVX,moveVY)*2.3+2.2):0).toFixed(1);
    hdgEl.textContent=String((Math.round(rot)%360+360)%360).padStart(3,"0");scoreEl.textContent=String(Math.max(0,Math.round(score))).padStart(4,"0");batteryEl.textContent=Math.max(0,Math.round(battery));
  }
  function flashComplete(label="MISSION COMPLETE"){flash.textContent=label;flash.classList.remove("show");void flash.offsetWidth;flash.classList.add("show");window.IDPTone?.(760,.22)}
  function warn(msg){warning.textContent=msg;warning.classList.remove("show");void warning.offsetWidth;warning.classList.add("show");window.IDPTone?.(145,.18,"square")}
  function addScore(v,label){score+=v;draw();if(label)flashComplete(`${label} +${v}`)}
  function resetEnv(){
    wildfire.classList.remove("show");target.classList.remove("show");hoverZone.classList.remove("show");
    rings.forEach(r=>{r.classList.remove("show","passed")});missingPerson.classList.remove("show");coordBox.classList.remove("show");nightBeacon.classList.remove("show");
    view.classList.remove("night-mode","search-mode");disasterMarker.classList.remove("show");patrolPoints.forEach(p=>p.classList.remove("show"));masterCore.classList.remove("show");
  }
  function resetCommon(){
    x=50;y=65;rot=0;alt=0;score=0;flying=false;paused=false;start=Date.now();lastMove=0;battery=100;completeShown=false;moveVX=moveVY=tiltX=tiltY=0;hold=0;ringIndex=0;searchFound=false;fireObserved=false;resetEnv();drone.classList.remove("climbing","landing");motorOff();draw();
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
    ],
    disaster:[
      ["LEVEL 07 / 01","TAKE OFF","재난지역 정찰을 시작하십시오."],
      ["LEVEL 07 / 02","CLIMB TO 8m","안전한 정찰 고도를 확보하십시오."],
      ["LEVEL 07 / 03","FIND SAFE ZONE","노란 SAFE ZONE을 찾아 접근하십시오."],
      ["LEVEL 07 / 04","OBSERVE","3초간 안전지점을 관측하십시오."],
      ["LEVEL 07 / 05","RETURN & LAND","정찰을 마치고 복귀하십시오."]
    ],
    patrol:[
      ["LEVEL 08 / 01","TAKE OFF","안전 순찰을 시작하십시오."],
      ["LEVEL 08 / 02","PATROL POINT 1","P1 지점을 확인하십시오."],
      ["LEVEL 08 / 03","PATROL POINT 2","P2 지점을 확인하십시오."],
      ["LEVEL 08 / 04","PATROL POINT 3","P3 지점을 확인하십시오."],
      ["LEVEL 08 / 05","RETURN & LAND","순찰을 마치고 복귀하십시오."]
    ],
    rescue:[
      ["LEVEL 09 / 01","TAKE OFF","종합 구조·순찰 미션을 시작하십시오."],
      ["LEVEL 09 / 02","SEARCH TARGET","오른쪽 아래 실종자를 찾으십시오."],
      ["LEVEL 09 / 03","CONFIRM LOCATION","3초간 위치를 확인하십시오."],
      ["LEVEL 09 / 04","CHECK SAFE ZONE","SAFE ZONE까지 이동해 안전지점을 확인하십시오."],
      ["LEVEL 09 / 05","RETURN & LAND","모든 임무 후 복귀하십시오."]
    ],
    master:[
      ["MASTER / 01","TAKE OFF","IDP MASTER CHALLENGE를 시작하십시오."],
      ["MASTER / 02","CLIMB TO 10m","고도 10m를 확보하십시오."],
      ["MASTER / 03","MASTER CORE","중앙 MASTER 구역에 진입하십시오."],
      ["MASTER / 04","HOLD 5 SECONDS","5초간 안정적인 정지비행을 유지하십시오."],
      ["MASTER / 05","FINAL LANDING","최종 정밀착륙으로 마스터 도전을 완료하십시오."]
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
      night:["IDP / LEVEL 6","NIGHT FLIGHT"],
      disaster:["IDP / LEVEL 7","DISASTER RECON"],
      patrol:["IDP / LEVEL 8","SAFETY PATROL"],
      rescue:["IDP / LEVEL 9","INTEGRATED RESCUE & PATROL"],
      master:["IDP / LEVEL 10","MASTER CHALLENGE"]
    };
    $("#modeTitle").textContent=labels[mode][0];$("#modeSubtitle").textContent=labels[mode][1];
    if(mode==="hover")hoverZone.classList.add("show");
    if(mode==="rings")rings.forEach(r=>r.classList.add("show"));
    if(mode==="search"){view.classList.add("search-mode");missingPerson.classList.add("show")}
    if(mode==="wildfire"){wildfire.classList.add("show");target.classList.add("show")}
    if(mode==="night"){view.classList.add("night-mode");nightBeacon.classList.add("show")}
    if(mode==="disaster"){disasterMarker.classList.add("show")}
    if(mode==="patrol"){patrolPoints.forEach(p=>p.classList.add("show"))}
    if(mode==="rescue"){missingPerson.classList.add("show");disasterMarker.classList.add("show")}
    if(mode==="master"){masterCore.classList.add("show")}
  }
  function open(newMode,levelOverride){mode=newMode;currentLevel=levelOverride||modeLevel[mode]||1;view.classList.add("open");document.body.style.overflow="hidden";resetCommon();setupMode();setMission(0);clearInterval(timerId);timerId=setInterval(tick,250);window.IDPTone?.(450,.18)}
  function close(){view.classList.remove("open");document.body.style.overflow="";clearInterval(timerId);motorOff()}
  function toggleFlight(){
    if(!flying){initMotorAudio();setMotor(.55,.15);window.IDPTone?.(180,.12,"sawtooth");setTimeout(()=>window.IDPTone?.(260,.18,"sine"),120);flying=true;alt=Math.max(1,alt);drone.classList.add("climbing");setTimeout(()=>drone.classList.remove("climbing"),700);addScore(200,"TAKE OFF");setMission(1)}
    else{
      const nearPad=Math.abs(x-50)<8&&y>74;
      if(alt<=1.4&&nearPad){
        drone.classList.add("landing");setMotor(.25);window.IDPTone?.(120,.16,"sine");setTimeout(()=>{motorOff();drone.classList.remove("landing")},500);flying=false;alt=0;const err=Math.hypot(x-50,(y-82)*.7),bonus=Math.round(clamp(800-err*45,350,800));addScore(bonus,"LANDING");
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
    if(k==="w"){y-=step;moveVY=-1;tiltY=-18;setMotor(.72,.18);if(mode==="basic"&&stage===2){addScore(250,"FORWARD");setMission(3)}}
    if(k==="s"){y+=step;moveVY=1;tiltY=18;setMotor(.67,.10)}
    if(k==="a"){x-=step;moveVX=-1;tiltX=-17;setMotor(.69,.12)}
    if(k==="d"){x+=step;moveVX=1;tiltX=17;setMotor(.69,.12)}
    if(e.key==="ArrowUp"){drone.classList.add("climbing");setMotor(.82,.2);setTimeout(()=>drone.classList.remove("climbing"),220);
      alt=clamp(alt+.5,0,30);y-=.25;
      if(mode==="basic"&&stage===1&&alt>=5){addScore(250,"ALTITUDE");setMission(2)}
      if(mode==="hover"&&stage===1&&alt>=6){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="search"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="wildfire"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="night"&&stage===1&&alt>=5){addScore(250,"ALTITUDE");setMission(2)}
      if(mode==="rings"&&stage===1&&alt>=4){setMission(1)}
      if(mode==="disaster"&&stage===1&&alt>=8){addScore(300,"ALTITUDE");setMission(2)}
      if(mode==="master"&&stage===1&&alt>=10){addScore(400,"ALTITUDE");setMission(2)}
    }
    if(e.key==="ArrowDown"){setMotor(.42);alt=clamp(alt-.5,0,30);y+=.25}
    if(e.key==="ArrowLeft"){rot-=7;setMotor(.62,.08)}if(e.key==="ArrowRight"){rot+=7;setMotor(.62,.08)}
    x=clamp(x,4,96);y=clamp(y,10,88);draw();setTimeout(()=>{tiltX*=.45;tiltY*=.45;if(flying)setMotor(.52);draw()},140);
  }
  addEventListener("keydown",key,{passive:false});

  function tick(){
    timerEl.textContent=nowTime();if(paused)return;
    if(flying){battery=Math.max(0,battery-.018);if(Date.now()-lastMove>320)setMotor(.50);if(battery<15&&Math.random()<.08)warn("LOW BATTERY")}
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
    if(mode==="disaster"&&flying){
      const d=dist(x,y,73,57);
      if(stage===2&&d<12){addScore(500,"SAFE ZONE FOUND");setMission(3);hold=0}
      if(stage===3){if(d<10){hold+=.25;text.textContent=`안전지점 관측 중... ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(600,"RECON COMPLETE");setMission(4)}}else hold=0}
    }
    if(mode==="patrol"&&flying){
      const pts=[[24,52],[55,39],[80,61]];
      if(stage>=1&&stage<=3){const idx=stage-1;if(dist(x,y,pts[idx][0],pts[idx][1])<9){addScore(450,`PATROL P${idx+1}`);patrolPoints[idx].style.opacity=".25";setMission(stage+1)}}
    }
    if(mode==="rescue"&&flying){
      if(stage===1&&dist(x,y,84,72)<14){addScore(550,"TARGET FOUND");setMission(2);hold=0}
      if(stage===2){const d=dist(x,y,84,72);if(d<12){hold+=.25;text.textContent=`위치 확인 중... ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(550,"LOCATION CONFIRMED");setMission(3)}}else hold=0}
      if(stage===3&&dist(x,y,73,57)<12){addScore(600,"SAFE ZONE CHECKED");setMission(4)}
    }
    if(mode==="master"&&flying){
      const d=dist(x,y,50,48);
      if(stage===2&&d<11){addScore(700,"MASTER CORE");setMission(3);hold=0}
      if(stage===3){if(d<10&&Math.abs(alt-10)<2&&(Date.now()-lastMove>350)){hold+=.25;text.textContent=`마스터 호버링... ${Math.min(5,hold).toFixed(1)} / 5.0초`;if(hold>=5){addScore(900,"MASTER HOLD");setMission(4)}}else hold=Math.max(0,hold-.5)}
    }
    draw();
  }

  function finish(landingBonus){
    if(completeShown)return;completeShown=true;const sec=Math.floor((Date.now()-start)/1000),timeBonus=Math.round(clamp(500-sec*4,100,500));score+=timeBonus;
    const maxByMode={basic:2000,hover:2200,rings:2500,search:2700,wildfire:2750,night:2500,disaster:2600,patrol:2650,rescue:2900,master:3300};
    const ratio=score/maxByMode[mode],stars=ratio>=.82?3:ratio>=.62?2:1;
    const titles={basic:"LEVEL 1 COMPLETE",hover:"LEVEL 2 HOVERING PASS",rings:"LEVEL 3 RING COURSE COMPLETE",search:"LEVEL 4 SEARCH COMPLETE",wildfire:"LEVEL 5 WILDFIRE REPORT COMPLETE",night:"LEVEL 6 NIGHT FLIGHT COMPLETE",disaster:"LEVEL 7 DISASTER RECON COMPLETE",patrol:"LEVEL 8 PATROL COMPLETE",rescue:"LEVEL 9 INTEGRATED MISSION COMPLETE",master:"IDP MASTER CHALLENGE COMPLETE"};
    const messages={
      basic:"기초 비행과 정밀 착륙 훈련을 완료했습니다.",
      hover:"10초 정지비행과 착륙 시험을 완료했습니다.",
      rings:"장애물 링 3개를 통과하고 안전하게 복귀했습니다.",
      search:"실종자 위치를 확인하고 안전하게 복귀했습니다.",
      wildfire:"산불 좌표를 확인·보고하고 복귀했습니다.",
      night:"저조도 비콘 확인과 야간 착륙을 완료했습니다.",
      disaster:"재난지역 안전지점 정찰과 복귀를 완료했습니다.",
      patrol:"지정된 3개 순찰지점을 모두 확인했습니다.",
      rescue:"수색·위치확인·안전지점 점검을 결합한 종합 미션을 완료했습니다.",
      master:"IDP 10단계 종합 훈련의 MASTER CHALLENGE를 완료했습니다."
    };
    $("#completeTitle").textContent=titles[mode];$("#stars").textContent="★".repeat(stars)+"☆".repeat(3-stars);$("#finalScore").textContent=Math.round(score);$("#finalTime").textContent=nowTime();$("#landingQuality").textContent=landingBonus>=700?"S":landingBonus>=550?"A":"B";$("#completeMessage").textContent=messages[mode];
    window.IDPProgress?.unlockNext(currentLevel);setTimeout(()=>$("#completeModal").classList.add("open"),700);window.IDPTone?.(880,.4)
  }
  $("#exitSim").onclick=close;$("#pauseBtn").onclick=()=>{paused=!paused;$("#pauseBtn").textContent=paused?"RESUME":"PAUSE"};
  $("#retryBtn").onclick=()=>{$("#completeModal").classList.remove("open");open(mode,currentLevel)};$("#homeBtn").onclick=()=>{$("#completeModal").classList.remove("open");close()};
  window.IDPSim={open,close};
})();
