// Keep customisation reads and writes attached to the company rendered on this page.
window.companyHeaders=()=>window.appPlatformAppearance?{'X-App-Appearance':'platform',...(window.appSharedAppearance?{'X-Opstack-Shared-Appearance':'1'}:{})}:{'X-Company-Id':window.appCompanyId||'default'};
window.companyAssetUrl=url=>{const scoped=new URL(url,location.origin);if(window.appPlatformAppearance){scoped.searchParams.delete('company');scoped.searchParams.set('platform','1');if(window.appSharedAppearance)scoped.searchParams.set('console','1');}else scoped.searchParams.set('company',window.appCompanyId||'default');return scoped.pathname+scoped.search+scoped.hash;};
window.companyLoginUrl=()=>'/login';
window.companyPreferenceKey=key=>{if(window.appPlatformAppearance)return key+'-platform';if(window.appNetworkId&&window.appNetworkId!=='default')key+='-network-'+window.appNetworkId;return(window.appCompanyId||'default')==='default'?key:key+'-'+window.appCompanyId;};
