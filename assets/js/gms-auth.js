(function(){
  'use strict';

  const IDP_CALLBACK = 'https://jeonseongkweon-cloud.github.io/idp-simulator/callback.html';
  const IDP_HOME = 'https://jeonseongkweon-cloud.github.io/idp-simulator/';

  function getCfg(){
    const c = window.IDP_CONFIG || window.CONFIG || window.SUPABASE_CONFIG || {};
    return {
      url: c.supabaseUrl || c.SUPABASE_URL || window.SUPABASE_URL || '',
      key: c.supabaseKey || c.supabaseAnonKey || c.SUPABASE_KEY || c.SUPABASE_ANON_KEY ||
           window.SUPABASE_KEY || window.SUPABASE_ANON_KEY || ''
    };
  }

  const cfg = getCfg();
  if(!window.supabase || !cfg.url || !cfg.key){
    console.warn('[IDP GMS] Supabase SDK/config missing.');
    return;
  }

  const client = window.supabase.createClient(cfg.url,cfg.key,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      flowType:'implicit'
    }
  });

  window.idpSupabase = client;

  const state={session:null,user:null,member:null,connected:false};
  window.IDPGMS={client,state,login:googleLogin,logout,getMember:()=>state.member};

  const $=id=>document.getElementById(id);

  async function lookupMember(user){
    if(!user) return null;
    const {data,error}=await client
      .from('members')
      .select('id,name,email,status,auth_user_id')
      .eq('auth_user_id',user.id)
      .maybeSingle();
    if(error){
      console.warn('[IDP GMS] member lookup:',error.message);
      return null;
    }
    return data||null;
  }

  function paint(){
    const result=$('loginResult');
    const btn=$('verifyId');

    if(state.user){
      if(result){
        result.innerHTML=state.member
          ? `✅ GMS 로그인 완료<br><b>${state.member.name||state.user.email}</b><br>${state.user.email}`
          : `⚠️ Google 인증 완료<br>${state.user.email}<br>GMS 회원정보 연결 대기`;
      }
      if(btn){btn.textContent='로그아웃';btn.dataset.mode='logout';}
    }else{
      if(result) result.innerHTML='Google 계정으로 로그인하면 훈련기록이 GMS에 저장됩니다.';
      if(btn){btn.textContent='Google 계정으로 로그인';btn.dataset.mode='login';}
    }
  }

  async function refresh(){
    const {data:{session}}=await client.auth.getSession();
    state.session=session||null;
    state.user=session?.user||null;
    state.member=state.user?await lookupMember(state.user):null;
    state.connected=!!state.member;
    window.IDP_GMS_MEMBER=state.member;
    paint();
  }

  async function googleLogin(){
    const {error}=await client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:IDP_CALLBACK,
        skipBrowserRedirect:false,
        queryParams:{prompt:'select_account'}
      }
    });
    if(error){
      const r=$('loginResult');
      if(r) r.textContent='Google 로그인 시작 실패: '+error.message;
    }
  }

  async function logout(){
    await client.auth.signOut();
    await refresh();
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
    setTimeout(refresh,150);
  });

  client.auth.onAuthStateChange(()=>setTimeout(refresh,150));
})();