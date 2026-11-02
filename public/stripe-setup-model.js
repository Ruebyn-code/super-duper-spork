(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.stripeSetupModel=value;})(globalThis,()=>{
 const keys=['id','networkId','locationId','customerId','basePriceId','userPriceId','subscriptionId','autoSync','automaticTax'];
 const planCore=p=>Object.fromEntries(keys.map(key=>[key,['autoSync','automaticTax'].includes(key)?p[key]===true:p[key]||'']));
 const settingsCore=s=>JSON.stringify([s.environment,s.enabled,s.connectionTested,s.apiKeyConfigured,s.webhookConfigured,s.accountId,s.plans.map(planCore)]);
 function completion(s,p){if(!s)return Array(5).fill(false);const ready=Boolean(p&&p.customerId&&p.basePriceId&&p.userPriceId),linked=Boolean(p?.subscriptionId&&['active','trialing'].includes(p.status)),pending=Boolean(s.pendingCustomers?.length||s.plans.some(p=>p.pending?.length));return[Boolean(s.apiKeyConfigured&&s.connectionTested),Boolean(s.webhookConfigured&&s.webhookUrl),ready,linked,Boolean(linked&&p.approved&&p.autoSync&&s.enabled&&!pending&&!s.error)];}
 function firstIncomplete(s,p){const index=completion(s,p).findIndex(value=>!value);return index<0?5:index+1;}
 function enablingPayload(s,requestId){return{revision:s.revision,environment:s.environment,requestId,apiKey:'',webhookSecret:'',enabled:true,clearCredentials:false,plans:s.plans.map(planCore)};}
 return{planCore,settingsCore,completion,firstIncomplete,enablingPayload};
});
