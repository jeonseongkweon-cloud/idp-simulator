(function(){
  'use strict';

  const IDP_CALLBACK = 'https://jeonseongkweon-cloud.github.io/idp-simulator/callback.html';
  const IDP_HOME = 'https://jeonseongkweon-cloud.github.io/idp-simulator/';

  function getCfg(){
    const c = window.IDP_CONFIG || window.CONFIG || window.SUPABASE_CONFIG || {};
    return {
      url: c.supabaseUrl || c.SUPABASE_URL || window.SUPABASE_URL || '',
      key: c.supabaseKey || c.supabaseAnonKey || c.SUPABASE_KEY || c.SUPABASE_ANON_KEY || window.SUPABASE_KEY || window.SUPABASE_ANON_KEY || ''
    };
  }

  const {url,key} = getCfg();

  if(!window.supabase){
    console.warn('[IDP GMS] Supabase SDK not loaded.');
    return;
  }
  if(!url || !key){
    console.warn('[IDP GMS] Supabase config not found.', {hasUrl:!!url,hasKey:!!key});
    return;
  }

  const client = window.supabase.createClient(url,key,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      flowType:'pkce'
    }
  });

  window.idpSupabase = client;

  const state={session:null,user:null,member:null,connected:false};
  window.IDPGMS={
    client,state,
    login:googleLogin,
    logout,
    recordCompletion,
    getMember:()=>state.member
  };

  const $ = id => document.getElementById(id);

  function dispatch(message=''){
    window.dispatchEvent(new CustomEvent('idp-gms-auth',{detail:{
      connected:state.connected,
      name:state.member?.name||'',
      email:state.user?.email||'',
      message
    }}));
  }

  async function getMemberByUser(user){
    if(!user) return null;
    const {data,error}=await client
      .from('members')
      .select('id,name,email,status,auth_user_id')
      .eq('auth_user_id',user.id)
      .maybeSingle();
    if(error){
      console.warn('[IDP GMS] member lookup failed:',error.message);
      return null;
    }
    return data || null;
  }

  async function refresh(){
    const {data:{session},error}=await client.auth.getSession();
    if(error || !session){
      state.session=null;state.user=null;state.member=null;state.connected=false;
      dispatch();
      updateLoginUI();
      return;
    }

    state.session=session;
    state.user=session.user;
    state.member=await getMemberByUser(session.user);
    state.connected=!!state.member;

    dispatch(state.connected ? 'GMS 연결 완료' : 'Google 인증은 되었지만 GMS 회원정보가 연결되지 않았습니다.');
    updateLoginUI();
  }

  function updateLoginUI(){
    const result=$('loginResult');
    const btn=$('verifyId');

    if(state.user){
      if(result){
        result.innerHTML=state.member
          ? `✅ GMS 로그인 완료<br><b>${state.member.name || state.user.email}</b><br>${state.user.email}`
          : `⚠️ Google 로그인 완료<br>${state.user.email}<br>GMS 회원정보 연결 대기`;
      }
      if(btn){
        btn.textContent='로그아웃';
        btn.dataset.mode='logout';
      }
    }else{
      if(result) result.innerHTML='Google 계정으로 로그인하면 훈련기록이 GMS에 저장됩니다.';
      if(btn){
        btn.textContent='Google 계정으로 로그인';
        btn.dataset.mode='login';
      }
    }
  }

  async function googleLogin(){
    localStorage.setItem('idp_oauth_return',IDP_HOME);

    const {error}=await client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:IDP_CALLBACK,
        skipBrowserRedirect:false,
        queryParams:{prompt:'select_account'}
      }
    });

    if(error){
      const result=$('loginResult');
      if(result) result.textContent='Google 로그인 시작 실패: '+error.message;
      dispatch('Google 로그인 시작 실패: '+error.message);
    }
  }

  async function logout(){
    await client.auth.signOut();
    state.session=null;state.user=null;state.member=null;state.connected=false;
    updateLoginUI();
    dispatch('로그아웃 완료');
  }

  async function recordCompletion(info){
    const resultEl=$('gmsSaveResult');

    if(!state.connected || !state.member){
      if(resultEl) resultEl.textContent='GMS 비로그인 · 훈련기록은 저장되지 않았습니다.';
      return {saved:false};
    }

    const seconds=Math.max(1,Number(info?.seconds||0));
    const minutes=Math.max(1,Math.ceil(seconds/60));
    const level=Number(info?.level||1);
    const score=Math.round(Number(info?.score||0));
    const stars=Number(info?.stars||0);
    const mode=String(info?.mode||'TRAINING');

    if(resultEl) resultEl.textContent='GMS에 훈련기록 저장 중…';

    const {error}=await client.rpc('gms_record_simulator_activity',{
      p_member_id:state.member.id,
      p_organization_code:'IDP',
      p_simulator_key:`IDP-LEVEL-${level}`,
      p_simulator_title:`IDP Drone Simulator LEVEL ${level}`,
      p_minutes:minutes,
      p_level_or_mission:`LEVEL ${level} · ${mode} · SCORE ${score} · ${stars}STAR`
    });

    if(error){
      if(resultEl) resultEl.textContent='GMS 기록 저장 실패 · '+error.message;
      return {saved:false,error};
    }

    const estimatedPoints=Math.floor(minutes/10)*2;
    if(resultEl){
      resultEl.textContent=`✅ GMS 기록 저장 완료 · ${minutes}분${estimatedPoints>0?` · +${estimatedPoints} G-POINT`:''}`;
    }
    return {saved:true,minutes,estimatedPoints};
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const btn=$('verifyId');
    if(btn){
      btn.addEventListener('click',async e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        if(btn.dataset.mode==='logout') await logout();
        else await googleLogin();
      },true);
    }
    setTimeout(refresh,100);
  });

  client.auth.onAuthStateChange(()=>setTimeout(refresh,100));
})();