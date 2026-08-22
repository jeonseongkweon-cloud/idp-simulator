(() => {
  const cfg=window.IDP_CONFIG||{};
  const state={session:null,user:null,member:null,connected:false};
  const client=window.supabase?.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
  });
  window.IDPGMS={client,state,login,logout,recordCompletion,getMember:()=>state.member};

  function dispatch(message=''){
    window.dispatchEvent(new CustomEvent('idp-gms-auth',{detail:{
      connected:state.connected,name:state.member?.name||'',email:state.user?.email||'',message
    }}));
  }
  function callbackUrl(){ return new URL('./callback.html',location.href).href; }
  function homeUrl(){ return new URL('./',location.href).href; }

  async function refresh(){
    if(!client){dispatch('Supabase SDK 연결 실패');return}
    const {data:{session},error}=await client.auth.getSession();
    if(error||!session){state.session=null;state.user=null;state.member=null;state.connected=false;dispatch();return}
    state.session=session; state.user=session.user;
    const {data:member,error:mErr}=await client.from('members')
      .select('id,name,email,status').eq('auth_user_id',session.user.id).maybeSingle();
    if(mErr||!member){state.member=null;state.connected=false;dispatch('Google 인증은 되었지만 GMS 회원정보가 연결되지 않았습니다.');return}
    state.member=member;state.connected=true;dispatch();
  }
  async function login(){
    if(!client)return;
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:callbackUrl()}});
    if(error) dispatch('Google 로그인 시작 실패: '+error.message);
  }
  async function logout(){
    if(client) await client.auth.signOut();
    state.session=null;state.user=null;state.member=null;state.connected=false;dispatch('로그아웃 완료');
  }
  async function recordCompletion(info){
    const resultEl=document.getElementById('gmsSaveResult');
    if(!state.connected||!state.member){
      if(resultEl) resultEl.textContent='GMS 비로그인 · 훈련기록은 저장되지 않았습니다.';
      return {saved:false};
    }
    const seconds=Math.max(1,Number(info.seconds||0));
    const minutes=Math.max(1,Math.ceil(seconds/60));
    if(resultEl) resultEl.textContent='GMS에 훈련기록 저장 중…';
    const mission=`LEVEL ${info.level} · ${info.mode} · SCORE ${Math.round(info.score||0)} · ${info.stars||0}STAR`;
    const {error}=await client.rpc('gms_record_simulator_activity',{
      p_member_id:state.member.id,
      p_organization_code:'IDP',
      p_simulator_key:`IDP-LEVEL-${info.level}`,
      p_simulator_title:`IDP Drone Simulator LEVEL ${info.level}`,
      p_minutes:minutes,
      p_level_or_mission:mission
    });
    if(error){
      if(resultEl) resultEl.textContent='GMS 기록 저장 실패 · '+error.message;
      return {saved:false,error};
    }
    const estimatedPoints=Math.floor(minutes/10)*2;
    if(resultEl) resultEl.textContent=`✅ GMS 기록 저장 완료 · ${minutes}분${estimatedPoints>0?` · +${estimatedPoints} G-POINT`:''}`;
    return {saved:true,minutes,estimatedPoints};
  }

  client?.auth.onAuthStateChange(()=>setTimeout(refresh,80));
  window.addEventListener('load',()=>setTimeout(refresh,120));
})();
