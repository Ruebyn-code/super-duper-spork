// Keep customisation reads and writes attached to the company rendered on this page.
window.companyHeaders=()=>({'X-Company-Id':window.appCompanyId||'default'});
window.companyAssetUrl=url=>{const scoped=new URL(url,location.origin);scoped.searchParams.set('company',window.appCompanyId||'default');return scoped.pathname+scoped.search+scoped.hash;};
window.companyLoginUrl=()=>companyAssetUrl('/login');
window.companyPreferenceKey=key=>(window.appCompanyId||'default')==='default'?key:key+'-'+window.appCompanyId;
