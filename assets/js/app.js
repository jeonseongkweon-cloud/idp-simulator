
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
  $$("[data-close]").forEach(b=>b.onclick=closeModals); $$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
  $$("[data-open]").forEach(el=>el.onclick=e=>{
    const t=e.currentTarget.dataset.open;
    if(t==="login")openModal("#loginModal");
    if(t==="guide")openModal("#guideModal");
    if(t==="simulator")window.IDPSim.open("basic");
    if(t==="hover")window.IDPSim.open("hover");
    if(t==="rings")window.IDPSim.open("rings");
    if(t==="search")window.IDPSim.open("search");
    if(t==="wildfire")window.IDPSim.open("wildfire");
    if(t==="night")window.IDPSim.open("night");
  });
  $("#verifyId").onclick=()=>{const id=$("#memberId").value.trim().toUpperCase(),out=$("#loginResult");if(["IDP2026","IDP-KR-000001"].includes(id)){out.innerHTML=`✅ 인증 성공: <b>${id}</b>`;tone(720,.2)}else{out.innerHTML=`❌ 데모 ID <b>IDP2026</b>을 입력해 보세요.`;tone(130,.2,"square")}};
  window.IDPTone=tone;
})();
