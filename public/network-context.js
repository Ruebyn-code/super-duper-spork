(()=>{
 const network=window.appNetworkId,original=window.fetch;
 window.fetch=function(input,options){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/opstack/')){const headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined));headers.set('X-Opstack-Network',network);options={...options,headers};}return original.call(this,input,options);};
})();
