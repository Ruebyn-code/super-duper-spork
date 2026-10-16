// Keep customisation reads and writes attached to the company rendered on this page.
window.companyHeaders=()=>window.appPlatformAppearance?{'X-App-Appearance':'platform'}:{'X-Company-Id':window.appCompanyId||'default'};
window.companyAssetUrl=url=>{const scoped=new URL(url,location.origin);if(window.appPlatformAppearance){scoped.searchParams.delete('company');scoped.searchParams.set('platform','1');}else scoped.searchParams.set('company',window.appCompanyId||'default');return scoped.pathname+scoped.search+scoped.hash;};
window.companyLoginUrl=()=>'/login';
window.companyPreferenceKey=key=>window.appPlatformAppearance?key+'-platform':(window.appCompanyId||'default')==='default'?key:key+'-'+window.appCompanyId;
