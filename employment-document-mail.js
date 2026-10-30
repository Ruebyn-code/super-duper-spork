'use strict';
const {sender}=require('./account-invitations');
const {copy}=require('./employment-document-model');
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function send({kind,doc,party,code,id,origin,network},{env,fetchImpl=fetch}){
 const config=sender(env);let subject,text,html;
 if(kind==='invite'){
  const link=new URL('/employment-documents',origin);if(network)link.searchParams.set('network',network);link.searchParams.set('document',doc.id);
  subject='Review and sign: '+doc.title;text='Hello '+party.name+',\n\n'+doc.legalEmployer+' has sent you an employment agreement to review and sign as '+party.role+'.\n\n'+link.href+'\n\nSign in with your own OpStack account, then request a fresh verification code before signing. Activate your account from its separate setup invitation first if needed. You can download the document before deciding, decline, or request paper signing. Opening this email does not sign anything. Only your assigned OpStack account can open and sign this document.';html='<div style="font:15px/1.6 Arial,sans-serif;max-width:650px;margin:auto"><h1>Review your agreement</h1><p>Hello '+escape(party.name)+',</p><p>'+escape(doc.legalEmployer)+' has sent you an agreement to review and sign as '+escape(party.role)+'.</p><p><a href="'+escape(link.href)+'">Sign in to review agreement</a></p><p>Sign in with your own OpStack account, then request a fresh verification code before signing. Activate your account from its separate setup invitation first if needed. You can download the document before deciding, decline, or request paper signing. Opening this email does not sign anything. Only your assigned OpStack account can open and sign this document.</p></div>';
 }else if(kind==='code'){
  subject='Your OpStack signing verification code';text='Your verification code is '+code+'.\n\nIt expires in 10 minutes and verifies access to this email for '+doc.legalEmployer+'’s agreement. This code does not sign the agreement. If you did not request it, ignore this message.';html='<p>Your OpStack signing verification code is <strong>'+code+'</strong>.</p><p>It expires in 10 minutes. This code does not sign the agreement. If you did not request it, ignore this message.</p>';
 }else{
  const completed=copy(doc);subject='Completed agreement: '+doc.title;html=completed.html;text=doc.title+'\n\nLegal employer: '+doc.legalEmployer+'\nEmployee: '+doc.employeeName+'\nReference: '+doc.id+'\n\n'+doc.body+'\n\nElectronic signing record\n'+doc.parties.map(p=>p.role+': '+p.name+' · '+p.email+' · '+p.signature.signedAt+'\n'+p.signature.consent+'\n'+p.signature.intention).join('\n')+'\n\nDocument SHA-256: '+doc.documentHash+'\nSigning-record SHA-256: '+doc.completed.hash+'\n\nKeep this completed copy with your records. Signing evidence does not certify the contract terms.';
 }
 try{const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key,'Idempotency-Key':'opstack-employment-'+id},body:JSON.stringify({from:config.from,to:[party.email],subject,text,html}),signal:AbortSignal.timeout(15000),redirect:'error'});return{status:response.ok?'accepted':'failed'};}catch{return{status:'unconfirmed'};}
}
module.exports={send};
