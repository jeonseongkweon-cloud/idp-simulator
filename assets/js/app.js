
(() => {
  let soundOn=true,audioCtx=null;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  function tone(freq=220,duration=.12,type="sine",gain=.035){
    if(!soundOn)return;
    try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.stop(audioCtx.currentTime+duration)}catch(e){}
  }
  function intro(){[110,165,220,330].forEach((f,i)=>setTimeout(()=>tone(f,.65,"sawtooth",.022),i*110));setTimeout(()=>tone(660,.3,"sine",.04),500)}
  $("#enterSystem").onclick=()=>{intro();$("#boot").classList.add("hidden");setTimeout(()=>$("#boot").remove(),850)};
  $("#soundToggle").onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?"🔊":"🔇";if(soundOn)tone(480,.1)};
  $("#fullscreenBtn").onclick=async()=>{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.()};
  function openModal(id){$(id).classList.add("open");tone(360,.1)}
  function closeModals(){$$(".modal").forEach(m=>m.classList.remove("open"))}
  $$("[data-close]").forEach(b=>b.onclick=closeModals);$$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});

  function progress(){return Math.max(1,Math.min(10,parseInt(localStorage.getItem("idp_unlocked_level")||"1",10)))}
  function setProgress(level){localStorage.setItem("idp_unlocked_level",String(Math.max(progress(),Math.min(10,level))));renderProgress()}
  function renderProgress(){
    const unlocked=progress();
    $$(".level-card").forEach(card=>{
      const level=parseInt(card.dataset.level,10), locked=level>unlocked;
      card.classList.toggle("locked",locked);
      const state=card.querySelector(".lock-state"),btn=card.querySelector(".level-start");
      if(locked){state.textContent="🔒 LOCK";btn.textContent=`LEVEL ${level-1} 통과 필요`}
      else{
        state.textContent=level<unlocked?"✓ PASSED":"OPEN";
        btn.textContent=level<unlocked?"다시 훈련 →":"도전 시작 →";
      }
    });
    $("#progressText").textContent=`LEVEL ${unlocked} / 10`;
  }
  function locked(level){
    $("#lockedTitle").textContent=`LEVEL ${level} LOCKED`;
    $("#lockedMessage").textContent=`LEVEL ${level-1}을 먼저 통과해야 LEVEL ${level}이 열립니다.`;
    openModal("#lockedModal");
  }
  function startLevel(level,mode){
    if(level>progress()){locked(level);return}
    window.IDPSim?.open(mode,level);
  }
  $$(".level-card").forEach(card=>card.addEventListener("click",e=>{
    if(e.target.closest(".level-start")||e.currentTarget===card){
      startLevel(parseInt(card.dataset.level,10),card.dataset.mode);
    }
  }));
  $("#goCurrentLevel").onclick=()=>{closeModals();document.getElementById("training").scrollIntoView({behavior:"smooth"})};
  $("#resetProgress").onclick=()=>{if(confirm("훈련 진행 기록을 LEVEL 1부터 다시 시작할까요?")){localStorage.setItem("idp_unlocked_level","1");renderProgress()}};

  $$("[data-open]").forEach(el=>el.onclick=e=>{
    const t=e.currentTarget.dataset.open;
    if(t==="login")openModal("#loginModal");
    if(t==="guide")openModal("#guideModal");
    if(t==="simulator")startLevel(1,"basic");
    if(t==="hover")startLevel(2,"hover");
    if(t==="wildfire")startLevel(5,"wildfire");
  });


  const googleLoginBtn=$("#googleLogin"), googleLogoutBtn=$("#googleLogout"), loginResult=$("#loginResult");
  if(googleLoginBtn) googleLoginBtn.onclick=()=>window.IDPGMS?.login();
  if(googleLogoutBtn) googleLogoutBtn.onclick=()=>window.IDPGMS?.logout();
  window.addEventListener("idp-gms-auth",e=>{
    const d=e.detail||{};
    if(loginResult) loginResult.innerHTML=d.connected
      ? `✅ GMS 연결: <b>${d.name||d.email||"회원"}</b><br><small>${d.email||""}</small>`
      : `비로그인 상태 · LEVEL 1 무료 체험 가능${d.message?`<br><small>${d.message}</small>`:""}`;
    if(googleLoginBtn) googleLoginBtn.classList.toggle("gms-hidden",!!d.connected);
    if(googleLogoutBtn) googleLogoutBtn.classList.toggle("gms-hidden",!d.connected);
  });

  window.IDPTone=tone;
  window.IDPProgress={get:progress,unlockNext:(completedLevel)=>setProgress(Math.min(10,completedLevel+1)),render:renderProgress};
  renderProgress();
})();
