const crypto=require('node:crypto');
const lifetime=48*60*60*1000;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function email(value){
 if(typeof value!=='string'||value.length>254||!/^\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*$/.test(value)||/[\r\n\x00-\x1f]/.test(value))fail('Enter a valid email address.');
 return value.trim().toLowerCase();
}
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
function issue(now){const token=crypto.randomBytes(32).toString('hex');return{token,record:{id:crypto.randomUUID(),tokenHash:digest(token),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+lifetime).toISOString(),status:'pending'}};}
function find(accounts,token,now){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('This setup link is invalid or has expired. Ask your manager to resend the invitation.');
 const hash=digest(token),account=accounts.find(account=>account.invitation?.tokenHash===hash);
 if(!account||Date.parse(account.invitation.expiresAt)<=now)fail('This setup link is invalid or has expired. Ask your manager to resend the invitation.');
 return account;
}
function sender(env){
 if(!env.enabled||!env.apiKey||!env.from)fail('Set up the shared sender in Opstack console → Account setup emails before inviting users.',503);
 return{key:env.apiKey,from:env.from};
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function send({account,token,invitationId,origin,company,inviter,network,setupPath='/accept-invite'},{env,fetchImpl=fetch}){
 const configuration=sender(env),link=new URL(setupPath,origin);if(network)link.searchParams.set('network',network);link.hash='token='+token;
 const render=(value,fallback)=>String(value||fallback).replace(/\{\{(name|inviter|company)\}\}/g,(_,key)=>({name:account.username,inviter,company}[key])),template=env.template||{},subject=render(template.subject,'Set up your Opstack account'),heading=render(template.heading,'Welcome to Opstack'),intro=render(template.intro,'{{inviter}} has invited you to Opstack for {{company}}.'),button=render(template.button,'Choose your password'),text=`Hi ${account.username},\n\n${intro}\n\nChoose your password:\n${link.href}\n\nSign-in email: ${account.email}\n\nThis link expires in 48 hours and can only be used once. If you were not expecting this invitation, you can ignore this email.`;
 const html=`<div style="font:16px/1.6 Arial,sans-serif;color:#182b3a;max-width:560px;margin:auto;padding:28px"><img src="${escape(origin)}/logo?platform=1" alt="Opstack" width="160"><h1 style="font-size:26px">${escape(heading)}</h1><p>Hi ${escape(account.username)},</p><p>${escape(intro)}</p><p><a href="${escape(link.href)}" style="display:inline-block;background:#0d74c0;color:white;padding:12px 20px;border-radius:9px;text-decoration:none">${escape(button)}</a></p><p>Sign-in email: <strong>${escape(account.email)}</strong></p><p style="font-size:13px;color:#627383">This link expires in 48 hours and can only be used once. If you were not expecting this invitation, you can ignore this email.</p></div>`;
 try{
  const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+configuration.key,'Idempotency-Key':'opstack-invitation-'+invitationId},body:JSON.stringify({from:configuration.from,to:[account.email],subject,text,html}),signal:AbortSignal.timeout(15000),redirect:'error'});
  return response.ok?{status:'sent',message:'Invitation accepted by the email service. The user can choose their password from the email.'}:{status:'failed',message:'The email service rejected the invitation (HTTP '+response.status+'). Check the shared account email settings, then resend the invitation.'};
 }catch{return{status:'unconfirmed',message:'Email delivery could not be confirmed. Check your email service before resending the invitation.'};}
}
module.exports={email,issue,find,sender,send,lifetime};
