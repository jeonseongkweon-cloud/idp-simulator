
(() => {
  let soundOn = true;
  let audioCtx = null;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function tone(freq=220, duration=.12, type="sine", gain=.035){
    if(!soundOn) return;
    try{
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type=type;o.frequency.value=freq;g.gain.value=gain;
      o.connect(g);g.connect(audioCtx.destination);o.start();
      g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
      o.stop(audioCtx.currentTime+duration);
    }catch(e){}
  }
  function introSound(){
    [110,165,220,330].forEach((f,i)=>setTimeout(()=>tone(f,.65,"sawtooth",.022),i*120));
    setTimeout(()=>tone(660,.32,"sine",.04),520);
  }

  $("#enterSystem").addEventListener("click", () => {
    introSound();
    $("#boot").classList.add("hidden");
    setTimeout(()=>$("#boot").remove(),850);
  });

  $("#soundToggle").addEventListener("click", e => {
    soundOn=!soundOn;e.currentTarget.textContent=soundOn?"🔊":"🔇";
    if(soundOn) tone(480,.12);
  });

  $("#fullscreenBtn").addEventListener("click", async()=>{
    if(!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });

  function openModal(id){
    const el=$(id); el.classList.add("open"); el.setAttribute("aria-hidden","false"); tone(360,.1);
  }
  function closeModals(){
    $$(".modal").forEach(m=>{m.classList.remove("open");m.setAttribute("aria-hidden","true")});
  }
  $$("[data-close]").forEach(b=>b.onclick=closeModals);
  $$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModals()}));

  $$("[data-open]").forEach(el=>el.addEventListener("click",e=>{
    const t=e.currentTarget.dataset.open;
    if(t==="login") openModal("#loginModal");
    if(t==="guide") openModal("#guideModal");
    if(t==="simulator") window.IDPSim?.open();
  }));

  $$("[data-locked]").forEach(el=>el.addEventListener("click",()=>openModal("#loginModal")));

  $("#verifyId").addEventListener("click", async()=>{
    const id=$("#memberId").value.trim().toUpperCase();
    const out=$("#loginResult");
    if(!id){out.textContent="ID 번호를 입력해 주세요."; tone(150,.18,"square"); return;}
    const cfg=window.IDP_CONFIG||{};
    if(cfg.googleSheetEndpoint){
      out.textContent="회원 정보를 확인 중입니다...";
      try{
        const r=await fetch(cfg.googleSheetEndpoint+"?id="+encodeURIComponent(id));
        const d=await r.json();
        if(d.valid){
          out.innerHTML=`✅ 인증되었습니다. <b>${d.name||id}</b> / 접근 LEVEL ${d.level||2}`;
          localStorage.setItem("idp_member",JSON.stringify(d));
          tone(720,.22);return;
        }
        out.textContent="등록되지 않은 ID입니다.";tone(130,.2,"square");return;
      }catch(e){out.textContent="회원 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";return;}
    }
    if((cfg.demoIds||[]).includes(id)){
      out.innerHTML=`✅ 데모 인증 성공: <b>${id}</b> · LEVEL 2 ACCESS`;
      localStorage.setItem("idp_member",JSON.stringify({id,level:2,demo:true}));
      tone(720,.22); return;
    }
    out.innerHTML=`❌ 현재 데모에서는 <b>IDP2026</b>을 입력해 보세요.`;
    tone(130,.2,"square");
  });

  window.IDPTone=tone;
})();
