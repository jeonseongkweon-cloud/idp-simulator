(() => {
  const $ = s => document.querySelector(s);
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const view = $('#simulatorView'), drone = $('#drone'), flightArea = $('#flightArea');
  const speedLines=$('#speedLines'), rpmText=$('#rpmText'), altEl=$('#alt'), spdEl=$('#spd'), hdgEl=$('#hdg'), scoreEl=$('#score'), timerEl=$('#timer'), batteryEl=$('#battery'), depthHud=$('#depthHud');
  const title=$('#missionTitle'), text=$('#missionText'), missionNo=$('#missionNo'), flash=$('#missionFlash'), warning=$('#warning');
  const wildfire=$('#wildfireZone'), target=$('#targetMarker'), hoverZone=$('#hoverZone');
  const rings=[$('#ring1'),$('#ring2'),$('#ring3')], missingPerson=$('#missingPerson'), coordBox=$('#coordBox'), nightBeacon=$('#nightBeacon');
  const disasterMarker=$('#disasterMarker'), patrolPoints=[$('#patrolPoint1'),$('#patrolPoint2'),$('#patrolPoint3')], masterCore=$('#masterCore');
  const landingPad=document.querySelector('.landing-pad'), outdoorPhoto=$('#outdoorPhoto'), groundGrid=document.querySelector('.ground-grid'), groundShadow=$('#groundShadow');
  const outboundGate=$('#outboundGate'), homeBeacon=$('#homeBeacon'), flightTrail=$('#flightTrail');

  const HOME={x:50,y:82};
  // LEVEL 1 photo alignment: center of the real yellow 25m gate in the background image.
  const GATE={x:42.5,y:31};
  let x=HOME.x,y=HOME.y,rot=0,alt=0,score=0,flying=false,paused=false,start=0,timerId=null,stage=0,lastMove=0,mode='basic',battery=100,completeShown=false;
  let vx=0,vy=0,speed=0,tiltX=0,tiltY=0,hold=0,ringIndex=0,currentLevel=1;
  let motorCtx=null,motorOsc=null,motorGain=null,motorFilter=null,motorLevel=0;
  let lastFrame=performance.now(), outboundSeconds=0, maxHomeDistance=0, turnReached=false;
  const held={w:false,s:false,a:false,d:false,up:false,down:false,left:false,right:false};
  const modeLevel={basic:1,hover:2,rings:3,search:4,wildfire:5,night:6,disaster:7,patrol:8,rescue:9,master:10};

  function initMotorAudio(){
    try{
      motorCtx ||= new (window.AudioContext||window.webkitAudioContext)();
      if(motorCtx.state==='suspended') motorCtx.resume();
      if(!motorOsc){
        motorOsc=motorCtx.createOscillator(); motorGain=motorCtx.createGain(); motorFilter=motorCtx.createBiquadFilter();
        motorOsc.type='sawtooth'; motorOsc.frequency.value=70; motorFilter.type='lowpass'; motorFilter.frequency.value=850;
        motorGain.gain.value=.0001; motorOsc.connect(motorFilter); motorFilter.connect(motorGain); motorGain.connect(motorCtx.destination); motorOsc.start();
      }
    }catch(e){}
  }
  function setMotor(level,boost=0){
    motorLevel=clamp(level,0,1); initMotorAudio();
    if(motorOsc&&motorGain){
      const t=motorCtx.currentTime, freq=70+motorLevel*115+boost*28;
      motorOsc.frequency.cancelScheduledValues(t); motorOsc.frequency.linearRampToValueAtTime(freq,t+.08);
      motorGain.gain.cancelScheduledValues(t); motorGain.gain.linearRampToValueAtTime(.004+motorLevel*.026,t+.08);
      motorFilter.frequency.linearRampToValueAtTime(700+motorLevel*1500,t+.08);
    }
    if(rpmText) rpmText.textContent=motorLevel<.05?'IDLE':`${Math.round(1800+motorLevel*7200)} RPM`;
  }
  function motorOff(){
    if(motorGain&&motorCtx){ const t=motorCtx.currentTime; motorGain.gain.cancelScheduledValues(t); motorGain.gain.linearRampToValueAtTime(.0001,t+.5); }
    if(rpmText) rpmText.textContent='IDLE';
  }
  const homeDistance=()=>Math.hypot((x-HOME.x)*1.15, y-HOME.y);
  function nowTime(){ const sec=Math.floor((Date.now()-start)/1000); return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }

  function draw(){
    const d=homeDistance();
    // v6.2: DEPTH (forward/back) and ALTITUDE are rendered separately.
    // Forward travel moves toward the 25m gate with strong perspective/parallax,
    // while altitude moves the aircraft vertically above its ground track.
    const altitudeLift=alt*0.78;
    const depthTravel=Math.max(0,HOME.y-y);
    const depthScreenY=(mode==='basic') ? HOME.y-depthTravel*0.52 : y;
    const screenY=clamp(depthScreenY-altitudeLift,7,89);
    const perspective=(mode==='basic')
      ? clamp(1.10-depthTravel*0.009,0.62,1.10)
      : clamp(1.04-depthTravel*0.0048,0.78,1.10);
    drone.style.left=x+'%'; drone.style.top=screenY+'%';
    drone.style.transform=`translate(-50%,-50%) rotateZ(${rot}deg) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${perspective})`;
    if(groundShadow){
      groundShadow.style.left=x+'%';
      groundShadow.style.top=y+'%';
      groundShadow.style.transform=`translate(-50%,-50%) scale(${clamp(1.22-alt*.028,.34,1.22)})`;
      groundShadow.style.opacity=clamp(.78-alt*.022,.16,.78);
      groundShadow.style.filter=`blur(${clamp(7+alt*.32,7,18)}px)`;
    }
    drone.classList.toggle('flying',flying); drone.classList.toggle('fast',flying&&speed>2.3); drone.classList.toggle('idle-wobble',flying&&speed<.45);
    flightArea.classList.toggle('speeding',flying&&speed>2.3); speedLines.classList.toggle('active',flying&&speed>2.3);
    flightArea.classList.toggle('outdoor-moving',flying&&speed>.7);

    if(outdoorPhoto){
      const parX=(HOME.x-x)*2.0;
      const parY=(mode==='basic' ? depthTravel*.32 : (HOME.y-y)*1.2);
      const zoom=(mode==='basic') ? 1.025+Math.min(depthTravel,54)*.0053 : 1.035+Math.min(d,55)*.0015;
      outdoorPhoto.style.transform=`translate(${parX}px,${parY}px) scale(${zoom})`;
    }
    if(groundGrid) groundGrid.style.backgroundPosition=`${(x-HOME.x)*9}px ${(HOME.y-y)*12}px, ${(HOME.y-y)*7}px ${(x-HOME.x)*5}px`;
    if(landingPad){
      const padScale=clamp(1.1-(HOME.y-y)*0.008,0.62,1.18);
      landingPad.style.transform=`translate(-50%,-50%) rotateX(55deg) scale(${padScale})`;
    }
    if(homeBeacon){ homeBeacon.classList.toggle('show',flying && d>15); }
    if(outboundGate){ outboundGate.classList.toggle('reached',turnReached); }

    const shadow=drone.querySelector('.drone-shadow');
    if(shadow) shadow.style.display='none';
    altEl.textContent=alt.toFixed(1); spdEl.textContent=speed.toFixed(1); depthHud.textContent=Math.round(d); hdgEl.textContent=String((Math.round(rot)%360+360)%360).padStart(3,'0');
    scoreEl.textContent=String(Math.max(0,Math.round(score))).padStart(4,'0'); batteryEl.textContent=Math.max(0,Math.round(battery));
  }

  function flashComplete(label='MISSION COMPLETE'){ flash.textContent=label; flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show'); window.IDPTone?.(760,.22); }
  function warn(msg){ warning.textContent=msg; warning.classList.remove('show'); void warning.offsetWidth; warning.classList.add('show'); window.IDPTone?.(145,.18,'square'); }
  function addScore(v,label){ score+=v; draw(); if(label) flashComplete(`${label} +${v}`); }
  function clearHeld(){ Object.keys(held).forEach(k=>held[k]=false); }
  function resetEnv(){
    wildfire.classList.remove('show'); target.classList.remove('show'); hoverZone.classList.remove('show'); rings.forEach(r=>r.classList.remove('show','passed'));
    missingPerson.classList.remove('show'); coordBox.classList.remove('show'); nightBeacon.classList.remove('show'); disasterMarker.classList.remove('show'); patrolPoints.forEach(p=>{p.classList.remove('show');p.style.opacity=''}); masterCore.classList.remove('show');
    view.classList.remove('night-mode','search-mode'); flightArea.classList.remove('outdoor-moving','speeding'); outboundGate?.classList.remove('show','reached'); homeBeacon?.classList.remove('show');
  }
  function resetCommon(){
    x=HOME.x; y=HOME.y; rot=0; alt=0; score=0; flying=false; paused=false; start=Date.now(); lastMove=0; battery=100; completeShown=false;
    vx=vy=speed=tiltX=tiltY=0; hold=0; ringIndex=0; outboundSeconds=0; maxHomeDistance=0; turnReached=false; clearHeld(); resetEnv(); drone.classList.remove('climbing','landing'); motorOff(); draw();
  }

  const missionSets={
    basic:[
      ['MISSION 01','TAKE OFF','SPACE 키를 눌러 이륙하십시오.'],
      ['MISSION 02','CLIMB TO 5m','↑ 키를 눌러 고도 5m까지 상승하십시오.'],
      ['MISSION 03','25m GATE FLIGHT','W 키를 계속 눌러 노란 25m 게이트 중앙을 통과하십시오.'],
      ['MISSION 04','TURN 180°','←/→ 키로 기체를 약 180° 회전해 HOME을 바라보십시오.'],
      ['MISSION 05','RETURN HOME','W 키로 HOME 착륙장까지 직접 복귀하십시오.'],
      ['MISSION 06','PRECISION LAND','H 위에서 고도 1m 이하로 낮춘 뒤 SPACE로 착륙하십시오.']
    ],
    hover:[['LEVEL 2 / 01','TAKE OFF','SPACE 키로 이륙하십시오.'],['LEVEL 2 / 02','CLIMB TO 6m','고도 6m까지 상승하십시오.'],['LEVEL 2 / 03','ENTER HOVER ZONE','중앙 HOVER ZONE 안으로 이동하십시오.'],['LEVEL 2 / 04','HOLD 10 SECONDS','10초 정지비행을 유지하십시오.'],['LEVEL 2 / 05','LAND','착륙장으로 복귀해 착륙하십시오.']],
    rings:[['RING / 01','TAKE OFF','SPACE 키로 이륙하십시오.'],['RING / 02','PASS RING 1','첫 번째 링 중심을 통과하십시오.'],['RING / 03','PASS RING 2','두 번째 링을 통과하십시오.'],['RING / 04','PASS RING 3','세 번째 링을 통과하십시오.'],['RING / 05','RETURN & LAND','착륙장으로 복귀하십시오.']],
    search:[['SEARCH / 01','TAKE OFF','수색 임무를 시작하십시오.'],['SEARCH / 02','CLIMB TO 8m','수색 고도 8m를 확보하십시오.'],['SEARCH / 03','SEARCH AREA','화면 오른쪽 수색구역을 탐색하십시오.'],['SEARCH / 04','TARGET FOUND','실종자 근처에서 3초 위치를 유지하십시오.'],['SEARCH / 05','RETURN & LAND','안전하게 복귀하십시오.']],
    wildfire:[['FIRE / 01','TAKE OFF','산불 감시 비행을 시작하십시오.'],['FIRE / 02','CLIMB TO 8m','고도 8m를 확보하십시오.'],['FIRE / 03','FIND SMOKE','연기 발생 지역으로 접근하십시오.'],['FIRE / 04','CONFIRM & REPORT','산불 지점을 3초 관측하십시오.'],['FIRE / 05','RETURN SAFE','좌표 보고 후 복귀하십시오.']],
    night:[['NIGHT / 01','TAKE OFF','야간 비행을 시작하십시오.'],['NIGHT / 02','CLIMB TO 5m','고도 5m를 확보하십시오.'],['NIGHT / 03','FIND BEACON','푸른 비콘 위치를 찾으십시오.'],['NIGHT / 04','HOLD POSITION','비콘 근처에서 3초 정지비행하십시오.'],['NIGHT / 05','NIGHT LANDING','안전하게 착륙하십시오.']],
    disaster:[['LEVEL 07 / 01','TAKE OFF','재난지역 정찰을 시작하십시오.'],['LEVEL 07 / 02','CLIMB TO 8m','안전한 정찰 고도를 확보하십시오.'],['LEVEL 07 / 03','FIND SAFE ZONE','SAFE ZONE을 찾아 접근하십시오.'],['LEVEL 07 / 04','OBSERVE','3초간 안전지점을 관측하십시오.'],['LEVEL 07 / 05','RETURN & LAND','정찰 후 복귀하십시오.']],
    patrol:[['LEVEL 08 / 01','TAKE OFF','안전 순찰을 시작하십시오.'],['LEVEL 08 / 02','PATROL POINT 1','P1 지점을 확인하십시오.'],['LEVEL 08 / 03','PATROL POINT 2','P2 지점을 확인하십시오.'],['LEVEL 08 / 04','PATROL POINT 3','P3 지점을 확인하십시오.'],['LEVEL 08 / 05','RETURN & LAND','순찰 후 복귀하십시오.']],
    rescue:[['LEVEL 09 / 01','TAKE OFF','종합 구조·순찰 미션을 시작하십시오.'],['LEVEL 09 / 02','SEARCH TARGET','실종자를 찾으십시오.'],['LEVEL 09 / 03','CONFIRM LOCATION','3초간 위치를 확인하십시오.'],['LEVEL 09 / 04','CHECK SAFE ZONE','SAFE ZONE을 확인하십시오.'],['LEVEL 09 / 05','RETURN & LAND','모든 임무 후 복귀하십시오.']],
    master:[['MASTER / 01','TAKE OFF','MASTER CHALLENGE를 시작하십시오.'],['MASTER / 02','CLIMB TO 10m','고도 10m를 확보하십시오.'],['MASTER / 03','MASTER CORE','MASTER 구역에 진입하십시오.'],['MASTER / 04','HOLD 5 SECONDS','5초 정지비행을 유지하십시오.'],['MASTER / 05','FINAL LANDING','정밀착륙으로 완료하십시오.']]
  };

  function setMission(i){ stage=i; const m=missionSets[mode][i]; if(!m)return; missionNo.textContent=m[0]; title.textContent=m[1]; text.textContent=m[2]; }
  function setupMode(){
    const labels={basic:['IDP / LEVEL 1','2.5D OUTBOUND · TURN · RETURN'],hover:['IDP / LEVEL 2','HOVERING TEST'],rings:['IDP / OBSTACLE','RING COURSE'],search:['IDP / SEARCH','MISSING PERSON SEARCH'],wildfire:['IDP / WILDFIRE','COORDINATE REPORT MISSION'],night:['IDP / LEVEL 6','NIGHT FLIGHT'],disaster:['IDP / LEVEL 7','DISASTER RECON'],patrol:['IDP / LEVEL 8','SAFETY PATROL'],rescue:['IDP / LEVEL 9','INTEGRATED RESCUE & PATROL'],master:['IDP / LEVEL 10','MASTER CHALLENGE']};
    $('#modeTitle').textContent=labels[mode][0]; $('#modeSubtitle').textContent=labels[mode][1];
    if(mode==='basic') outboundGate?.classList.add('show');
    if(mode==='hover') hoverZone.classList.add('show');
    if(mode==='rings') rings.forEach(r=>r.classList.add('show'));
    if(mode==='search'){view.classList.add('search-mode');missingPerson.classList.add('show')}
    if(mode==='wildfire'){wildfire.classList.add('show');target.classList.add('show')}
    if(mode==='night'){view.classList.add('night-mode');nightBeacon.classList.add('show')}
    if(mode==='disaster') disasterMarker.classList.add('show');
    if(mode==='patrol') patrolPoints.forEach(p=>p.classList.add('show'));
    if(mode==='rescue'){missingPerson.classList.add('show');disasterMarker.classList.add('show')}
    if(mode==='master') masterCore.classList.add('show');
  }
  function open(newMode,levelOverride){ mode=newMode; currentLevel=levelOverride||modeLevel[mode]||1; view.classList.add('open'); document.body.style.overflow='hidden'; resetCommon(); setupMode(); setMission(0); clearInterval(timerId); timerId=setInterval(tick,250); lastFrame=performance.now(); window.IDPTone?.(450,.18); }
  function close(){ view.classList.remove('open'); document.body.style.overflow=''; clearInterval(timerId); motorOff(); clearHeld(); }

  function toggleFlight(){
    if(!flying){
      initMotorAudio(); setMotor(.58,.16); flying=true; alt=Math.max(1,alt); drone.classList.add('climbing'); setTimeout(()=>drone.classList.remove('climbing'),700); addScore(200,'TAKE OFF'); setMission(1);
    }else{
      const d=homeDistance();
      const last=missionSets[mode].length-1;
      if(stage<last){ warn('현재 미션을 먼저 완료한 뒤 HOME에 착륙하세요'); draw(); return; }
      if(alt<=1.2 && d<6.5){
        drone.classList.add('landing'); setMotor(.22); setTimeout(()=>{motorOff();drone.classList.remove('landing')},450); flying=false; alt=0; speed=0;
        const bonus=Math.round(clamp(850-d*55,450,850)); addScore(bonus,'PRECISION LANDING'); finish(bonus);
      } else warn(`HOME H 위로 복귀하고 고도 1m 이하로 낮추세요 · 거리 ${d.toFixed(1)}m`);
    }
    draw();
  }

  function keyState(e,on){
    if(!view.classList.contains('open'))return;
    // Use KeyboardEvent.code so controls work even when Korean IME/Hangul input is active.
    // e.key may become ㅈ/ㄴ/ㅁ/ㅇ/ㄱ instead of W/S/A/D/R on a Korean keyboard.
    const code=e.code;
    const controlled=['KeyW','KeyS','KeyA','KeyD','KeyR','KeyP','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
    if(controlled.includes(code)) e.preventDefault();

    if(on && code==='KeyR'){
      resetCommon(); setupMode(); setMission(0);
      if($('#pauseBtn')) $('#pauseBtn').textContent='PAUSE';
      flashComplete('FLIGHT RESET');
      return;
    }
    if(on && code==='KeyP'){
      paused=!paused; $('#pauseBtn').textContent=paused?'RESUME':'PAUSE'; clearHeld(); return;
    }
    if(on && code==='Space'){
      if(!paused && !e.repeat) toggleFlight(); return;
    }

    // Always release a held key on keyup, even if flight state changed mid-keypress.
    const map={KeyW:'w',KeyS:'s',KeyA:'a',KeyD:'d',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
    if(map[code]){
      if(on && (paused||!flying)) return;
      held[map[code]]=on;
    }
  }
  addEventListener('keydown',e=>keyState(e,true),{passive:false});
  addEventListener('keyup',e=>keyState(e,false),{passive:false});
  addEventListener('blur',clearHeld);

  function flightStep(ts){
    const dt=Math.min(.05,(ts-lastFrame)/1000||.016); lastFrame=ts;
    if(view.classList.contains('open') && !paused && flying){
      const turnRate=92; // deg/sec - clear visible yaw
      if(held.left){rot-=turnRate*dt; lastMove=Date.now();}
      if(held.right){rot+=turnRate*dt; lastMove=Date.now();}
      const rad=rot*Math.PI/180;
      let forward=0, strafe=0;
      if(held.w)forward+=1; if(held.s)forward-=1; if(held.d)strafe+=1; if(held.a)strafe-=1;
      const commanded=Math.hypot(forward,strafe)>0;
      const targetSpeed=commanded?6.4:0; speed += (targetSpeed-speed)*Math.min(1,dt*(commanded?5.4:3.0));
      if(commanded){
        const n=Math.hypot(forward,strafe)||1; forward/=n; strafe/=n;
        // 5.2 m/s is mapped to ~6.2 screen-% per second: a visible 6-9 second outbound leg.
        const screenRate=speed*1.38;
        const dx=(Math.sin(rad)*forward + Math.cos(rad)*strafe)*screenRate*dt;
        const dy=(-Math.cos(rad)*forward + Math.sin(rad)*strafe)*screenRate*dt;
        x=clamp(x+dx,5,95); y=clamp(y+dy,14,87);
        // TRAINING ASSIST: on LEVEL 1, forward flight gently converges to the
        // real 25m gate center; after the turn, it gently converges to HOME.
        // A/D still works and can override the line, but children are not forced
        // to make pixel-perfect steering corrections.
        if(mode==='basic' && held.w && Math.abs(strafe)<0.01){
          const tx=stage<=2 ? GATE.x : (stage>=4 ? HOME.x : x);
          x += (tx-x)*Math.min(1,dt*0.62);
        }
        vx=dx/dt; vy=dy/dt; lastMove=Date.now();
        tiltY=clamp(-forward*17,-18,18); tiltX=clamp(strafe*16,-18,18); setMotor(.68+Math.min(.16,speed*.018),.12);
        if(held.w) outboundSeconds+=dt;
      } else { vx*=.88; vy*=.88; tiltX*=.88; tiltY*=.88; if(Date.now()-lastMove>250)setMotor(.50); }
      if(held.up){alt=clamp(alt+4.2*dt,0,30);lastMove=Date.now();setMotor(.82,.2);}
      if(held.down){alt=clamp(alt-4.0*dt,0,30);lastMove=Date.now();setMotor(.38);}
      const d=homeDistance(); maxHomeDistance=Math.max(maxHomeDistance,d);
      basicProgress(dt,d);
      draw();
    }
    requestAnimationFrame(flightStep);
  }
  requestAnimationFrame(flightStep);

  function basicProgress(dt,d){
    if(mode!=='basic')return;
    if(stage===1 && alt>=5){ addScore(250,'ALTITUDE 5m'); setMission(2); outboundSeconds=0; }
    if(stage===2){
      const gateOffset=Math.abs(x-GATE.x);
      const gateRemain=Math.max(0,y-GATE.y);
      text.textContent=`25m 게이트 중앙으로 전진 · ${outboundSeconds.toFixed(1)}초 / 최소 5.0초 · 게이트 ${gateRemain.toFixed(0)}m`;
      if(outboundSeconds>=5 && y<=34 && gateOffset<8){ turnReached=true; addScore(400,'25m GATE PASS'); setMission(3); }
    }
    if(stage===3){
      const h=((rot%360)+360)%360; const towardHome=Math.atan2(HOME.x-x, -(HOME.y-y))*180/Math.PI; const err=Math.abs((((h-towardHome)+540)%360)-180);
      text.textContent=`기체를 HOME 방향으로 회전 · 방향 오차 ${err.toFixed(0)}°`;
      if(err<24){ addScore(350,'TURN COMPLETE'); setMission(4); }
    }
    if(stage===4){
      text.textContent=`HOME까지 ${d.toFixed(1)}m · W로 복귀하십시오.`;
      if(d<9){ addScore(450,'RETURN HOME'); setMission(5); }
    }
  }

  const targetDistance=(tx,ty)=>Math.hypot((x-tx)*1.1,y-ty);
  function tick(){
    timerEl.textContent=nowTime(); if(paused)return;
    if(flying){battery=Math.max(0,battery-.018);if(battery<15&&Math.random()<.08)warn('LOW BATTERY')}
    if(mode==='hover'&&flying){
      if(stage===1&&alt>=6){addScore(300,'ALTITUDE');setMission(2)}
      const d=targetDistance(50,54); if(stage===2&&d<8&&Math.abs(alt-6)<2){addScore(400,'ZONE ENTERED');setMission(3);hold=0}
      if(stage===3){const stable=d<8&&Math.abs(alt-6)<2&&speed<.7;if(stable){hold+=.25;text.textContent=`정지비행 ${Math.min(10,hold).toFixed(1)} / 10.0초`;if(hold>=10){addScore(800,'HOVER PASS');setMission(4)}}else hold=Math.max(0,hold-.5)}
    }
    if(mode==='rings'&&flying){ const pts=[[29,52],[57,42],[80,60]]; if(stage===1&&alt>=4){} if(stage>=1&&stage<=3){const idx=stage-1;if(targetDistance(...pts[idx])<7){rings[idx].classList.add('passed');addScore(450,`RING ${idx+1}`);setMission(stage+1)}} }
    if(mode==='search'&&flying){ if(stage===1&&alt>=8){addScore(300,'ALTITUDE');setMission(2)} const d=targetDistance(84,72); if(stage===2&&d<14){addScore(500,'PERSON FOUND');setMission(3);hold=0} if(stage===3){if(d<12){hold+=.25;text.textContent=`실종자 위치 확인 ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(650,'LOCATION CONFIRMED');setMission(4)}}else hold=0} }
    if(mode==='wildfire'&&flying){ if(stage===1&&alt>=8){addScore(300,'ALTITUDE');setMission(2)} const d=targetDistance(84,63); if(stage===2&&d<13){addScore(450,'SMOKE DETECTED');setMission(3);hold=0} if(stage===3){if(d<12){hold+=.25;text.textContent=`산불 관측 ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){coordBox.classList.add('show');addScore(700,'COORDINATE REPORTED');setMission(4)}}else hold=0} }
    if(mode==='night'&&flying){ if(stage===1&&alt>=5){addScore(250,'ALTITUDE');setMission(2)} const d=targetDistance(72,56); if(stage===2&&d<12){addScore(450,'BEACON FOUND');setMission(3);hold=0} if(stage===3){if(d<10){hold+=.25;text.textContent=`비콘 정지비행 ${Math.min(3,hold).toFixed(1)} / 3.0초`;if(hold>=3){addScore(550,'NIGHT HOLD');setMission(4)}}else hold=0} }
    if(mode==='disaster'&&flying){ if(stage===1&&alt>=8){addScore(300,'ALTITUDE');setMission(2)} const d=targetDistance(73,57); if(stage===2&&d<12){addScore(500,'SAFE ZONE FOUND');setMission(3);hold=0} if(stage===3){if(d<10){hold+=.25;if(hold>=3){addScore(600,'RECON COMPLETE');setMission(4)}}else hold=0} }
    if(mode==='patrol'&&flying){ const pts=[[24,52],[55,39],[80,61]]; if(stage>=1&&stage<=3){const idx=stage-1;if(targetDistance(...pts[idx])<9){addScore(450,`PATROL P${idx+1}`);patrolPoints[idx].style.opacity='.25';setMission(stage+1)}} }
    if(mode==='rescue'&&flying){ if(stage===1&&targetDistance(84,72)<14){addScore(550,'TARGET FOUND');setMission(2);hold=0} if(stage===2){const d=targetDistance(84,72);if(d<12){hold+=.25;if(hold>=3){addScore(550,'LOCATION CONFIRMED');setMission(3)}}else hold=0} if(stage===3&&targetDistance(73,57)<12){addScore(600,'SAFE ZONE CHECKED');setMission(4)} }
    if(mode==='master'&&flying){ if(stage===1&&alt>=10){addScore(400,'ALTITUDE');setMission(2)} const d=targetDistance(50,48); if(stage===2&&d<11){addScore(700,'MASTER CORE');setMission(3);hold=0} if(stage===3){if(d<10&&Math.abs(alt-10)<2&&speed<.7){hold+=.25;if(hold>=5){addScore(900,'MASTER HOLD');setMission(4)}}else hold=Math.max(0,hold-.5)} }
    draw();
  }

  function finish(landingBonus){
    if(completeShown)return; completeShown=true; const sec=Math.floor((Date.now()-start)/1000),timeBonus=Math.round(clamp(500-sec*4,100,500)); score+=timeBonus;
    const maxByMode={basic:3000,hover:2200,rings:2500,search:2700,wildfire:2750,night:2500,disaster:2600,patrol:2650,rescue:2900,master:3300};
    const ratio=score/maxByMode[mode],stars=ratio>=.82?3:ratio>=.62?2:1;
    const titles={basic:'LEVEL 1 COMPLETE',hover:'LEVEL 2 HOVERING PASS',rings:'LEVEL 3 RING COURSE COMPLETE',search:'LEVEL 4 SEARCH COMPLETE',wildfire:'LEVEL 5 WILDFIRE REPORT COMPLETE',night:'LEVEL 6 NIGHT FLIGHT COMPLETE',disaster:'LEVEL 7 DISASTER RECON COMPLETE',patrol:'LEVEL 8 PATROL COMPLETE',rescue:'LEVEL 9 INTEGRATED MISSION COMPLETE',master:'IDP MASTER CHALLENGE COMPLETE'};
    const messages={basic:`이륙 → ${maxHomeDistance.toFixed(0)}m 전진 → 180° 선회 → HOME 복귀 → 정밀착륙을 완료했습니다.`,hover:'10초 정지비행과 착륙 시험을 완료했습니다.',rings:'장애물 링 코스를 완료했습니다.',search:'실종자 위치 확인 임무를 완료했습니다.',wildfire:'산불 좌표 보고 임무를 완료했습니다.',night:'야간 비행 임무를 완료했습니다.',disaster:'재난지역 정찰 임무를 완료했습니다.',patrol:'안전 순찰 임무를 완료했습니다.',rescue:'종합 구조·순찰 임무를 완료했습니다.',master:'MASTER CHALLENGE를 완료했습니다.'};
    $('#completeTitle').textContent=titles[mode]; $('#stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars); $('#finalScore').textContent=Math.round(score); $('#finalTime').textContent=nowTime(); $('#landingQuality').textContent=landingBonus>=750?'S':landingBonus>=600?'A':'B'; $('#completeMessage').textContent=messages[mode];
    window.IDPProgress?.unlockNext(currentLevel); setTimeout(()=>$('#completeModal').classList.add('open'),650); window.IDPTone?.(880,.4);
  }

  $('#exitSim').onclick=close; $('#pauseBtn').onclick=()=>{paused=!paused;clearHeld();$('#pauseBtn').textContent=paused?'RESUME':'PAUSE'}; const resetBtn=$('#resetFlightBtn'); if(resetBtn) resetBtn.onclick=()=>{resetCommon();setupMode();setMission(0);$('#pauseBtn').textContent='PAUSE';flashComplete('FLIGHT RESET')};
  $('#retryBtn').onclick=()=>{$('#completeModal').classList.remove('open');open(mode,currentLevel)}; $('#homeBtn').onclick=()=>{$('#completeModal').classList.remove('open');close()};
  window.IDPSim={open,close};
})();
