(function(){
  'use strict';

  const IDP_CALLBACK = 'https://jeonseongkweon-cloud.github.io/idp-simulator/callback.html';
  const IDP_HOME = 'https://jeonseongkweon-cloud.github.io/idp-simulator/';

  function getCfg(){
    const c = window.IDP_CONFIG || window.CONFIG || window.SUPABASE_CONFIG || {};
    const url = c.supabaseUrl || c.SUPABASE_URL || window.SUPABASE_URL;
    const key = c.supabaseAnonKey || c.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    return {url,key};
  }

  const {url,key} = getCfg();
  if(!url || !key || !window.supabase){
    console.warn('[IDP GMS] Supabase config not found.');
    return;
  }

  const client = window.supabase.createClient(url,key);
  window.idpSupabase = client;

  const $ = (id)=>document.getElementById(id);

  async function getMemberByUser(user){
    if(!user) return null;
    const {data,error} = await client
      .from('members')
      .select('id,name,email,auth_user_id')
      .eq('auth_user_id',user.id)
      .maybeSingle();
    if(error){
      console.warn('[IDP GMS] member lookup:',error.message);
      return null;
    }
    return data || null;
  }

  async function refreshLoginUI(){
    const {data:{session}} = await client.auth.getSession();
    const user = session?.user || null;
    const member = await getMemberByUser(user);

    window.IDP_GMS_SESSION = session || null;
    window.IDP_GMS_USER = user || null;
    window.IDP_GMS_MEMBER = member || null;

    const result = $('loginResult');
    const verify = $('verifyId');

    if(user){
      if(result){
        result.innerHTML = member
          ? `✅ GMS 로그인 완료<br><b>${member.name || user.email}</b><br>${user.email}`
          : `⚠️ Google 로그인 완료<br>${user.email}<br>GMS 회원정보 연결 대기`;
      }
      if(verify){
        verify.textContent='로그아웃';
        verify.dataset.mode='logout';
      }
    } else {
      if(result) result.innerHTML='Google 계정으로 로그인하면 훈련기록이 GMS에 저장됩니다.';
      if(verify){
        verify.textContent='Google 계정으로 로그인';
        verify.dataset.mode='login';
      }
    }
  }

  async function googleLogin(){
    localStorage.setItem('idp_oauth_return', IDP_HOME);
    const {error} = await client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo: IDP_CALLBACK,
        skipBrowserRedirect:false,
        queryParams:{
          access_type:'offline',
          prompt:'select_account'
        }
      }
    });
    if(error){
      console.error('[IDP GMS] Google login failed:',error);
      const result = $('loginResult');
      if(result) result.textContent='Google 로그인 시작 실패: '+error.message;
    }
  }

  async function logout(){
    await client.auth.signOut();
    await refreshLoginUI();
  }

  async function saveSimulatorRecord(payload){
    const member = window.IDP_GMS_MEMBER;
    if(!member){
      return {ok:false,reason:'GMS 비로그인'};
    }
    const params = {
      p_member_id: member.id,
      p_organization_code: 'IDP',
      p_simulator_key: String(payload.simulator_key || 'IDP-SIM'),
      p_simulator_title: String(payload.simulator_title || 'IDP Drone Simulator'),
      p_minutes: Math.max(1, Number(payload.minutes || 1)),
      p_level_or_mission: String(payload.level_or_mission || '')
    };
    const {error} = await client.rpc('gms_record_simulator_activity', params);
    if(error) return {ok:false,reason:error.message};
    return {ok:true};
  }
  window.IDP_GMS_SAVE_SIMULATOR = saveSimulatorRecord;

  document.addEventListener('DOMContentLoaded', async ()=>{
    const verify = $('verifyId');
    if(verify){
      verify.addEventListener('click', async (e)=>{
        e.preventDefault();
        if(verify.dataset.mode==='logout') await logout();
        else await googleLogin();
      }, true);
    }
    await refreshLoginUI();
  });

  client.auth.onAuthStateChange(async ()=>{ await refreshLoginUI(); });
})();