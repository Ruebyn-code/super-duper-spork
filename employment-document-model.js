'use strict';
const crypto=require('node:crypto');
const {calendarDate,age}=require('./award-rules');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max,label,optional=false)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)||!optional&&!value.trim())fail('Enter '+label+'.');return value.replace(/\r\n?/g,'\n').trim();};
const email=value=>{const result=text(value,254,'a valid email address').toLowerCase();if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)||/[\r\n]/.test(result))fail('Enter a valid email address.');return result;};
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
const secret=()=>crypto.randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const states=['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'];
const consent='I consent to using electronic records and electronic signatures for this agreement and to receiving my completed copy by email.';
const intention='I have had the opportunity to read and download the complete agreement. By typing my full name and selecting Sign agreement, I intend to sign and agree to the document shown.';
function signingIntention(party,doc){return intention+(party?.role==='employer'?' I confirm I am authorised to sign for '+doc.legalEmployer+'.':party?.role==='guardian'?' I confirm I am this employee’s parent or legal guardian.':'')+(doc.kind==='ifa'?' I confirm that this employee’s employment has commenced.':'');}
function normalize(input,today){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter the agreement details.');
 const kind=input.kind;if(!['employment-contract','ifa','employment-variation'].includes(kind))fail('Choose an employment agreement type.');
 const title=text(input.title,160,'an agreement title'),body=text(input.body,100000,'the complete reviewed agreement');if(body.length<40)fail('Enter the complete reviewed agreement, not just a title.');
 const employeeName=text(input.employeeName,160,'the employee’s full legal name'),employerName=text(input.employerName,160,'the employer representative’s full legal name'),reviewReference=text(input.reviewReference,500,'the document review reference');if(reviewReference.length<8)fail('Enter the document review reference (at least 8 characters).');
 if(!states.includes(input.jurisdiction))fail('Choose the applicable Australian state or territory.');
 const effectiveFrom=calendarDate(input.effectiveFrom),employmentStart=input.employmentStart?calendarDate(input.employmentStart):null,dateOfBirth=input.dateOfBirth?calendarDate(input.dateOfBirth):null;
 if(dateOfBirth&&(dateOfBirth>today||age(dateOfBirth,today)>120))fail('Check the employee’s date of birth.');
 if(kind==='ifa'&&(!employmentStart||!dateOfBirth))fail('An IFA needs the employee’s date of birth and employment commencement date.');
 const guardianRequired=input.guardianRequired===true||Boolean(dateOfBirth&&age(dateOfBirth,today)<18&&kind==='ifa');
 const guardianName=guardianRequired?text(input.guardianName,160,'the parent or guardian’s full legal name'):'',guardianId=guardianRequired?text(input.guardianId,100,'the parent or guardian’s OpStack account'):'';
 if(input.reviewed!==true||input.ordinaryAgreement!==true)fail('Confirm document review, employer authority and that this is an ordinary agreement without deed, witnessing or other special execution requirements.');
 if(input.replacesId&&!uuid(input.replacesId))fail('Choose a valid earlier agreement reference.');
 return{kind,title,body,employeeId:text(input.employeeId,100,'an existing employee'),locationId:text(input.locationId,100,'an employer location'),employeeName,employerName,reviewReference,jurisdiction:input.jurisdiction,effectiveFrom,employmentStart,dateOfBirth,guardianRequired,guardianName,guardianId,reviewed:true,ordinaryAgreement:true,replacesId:input.replacesId||null};
}
function source(doc){return {schemaVersion:1,...Object.fromEntries(['id','companyId','locationId','locationName','legalEmployer','kind','title','body','employeeId','employeeName','employerName','jurisdiction','effectiveFrom','employmentStart','guardianRequired','reviewReference','reviewed','ordinaryAgreement','replacesId','parties'].map(k=>[k,k==='parties'?doc.parties.map(p=>({id:p.id,role:p.role,name:p.name,email:p.email,userId:p.userId||null})):doc[k]]))};}
function append(doc,event,at,data={}){const item={sequence:doc.events.length+1,event,at,data,previousHash:doc.events.at(-1)?.hash||null};item.hash=hash(item);doc.events.push(item);}
function integrity(doc){
 let previous=null;for(const item of doc.events){const {hash:digest,...value}=item;if(value.previousHash!==previous||digest!==hash(value))fail('This signing record failed its integrity check. Contact your administrator.',409);previous=digest;}
 if(['sent','completed','declined','paper-requested'].includes(doc.status)&&!doc.documentHash)fail('The issued signing record is incomplete.',409);
 if(doc.documentHash&&(!doc.issuedAt||!doc.events.some(e=>e.event==='issued'&&e.at===doc.issuedAt&&e.data.documentHash===doc.documentHash)))fail('The signing issue record changed.',409);
 if(doc.documentHash&&doc.documentHash!==hash(source(doc)))fail('The issued document changed. Signing has been stopped.',409);
 const signedEvents=doc.events.filter(e=>e.event==='signed'),signedParties=doc.parties.filter(p=>p.signature);
 if(signedEvents.length!==signedParties.length||new Set(signedEvents.map(e=>e.data.partyId)).size!==signedEvents.length)fail('A stored signature is missing or duplicated. Contact your administrator.',409);
 for(const party of signedParties){const event=signedEvents.find(e=>e.data.partyId===party.id);if(!doc.documentHash||!event||hash(event.data)!==hash({partyId:party.id,userId:party.userId,role:party.role,...party.signature}))fail('A stored signature changed. Contact your administrator.',409);}
 if(doc.completed&&(hash(doc.completed.payload)!==doc.completed.hash||doc.status!=='completed'||doc.completedAt!==doc.completed.payload.completedAt||doc.completed.payload.documentHash!==doc.documentHash||hash(doc.completed.payload.document)!==hash(source(doc))||hash(doc.completed.payload.events)!==hash(doc.events)||doc.parties.some(p=>!p.signature)))fail('The completed signing record changed. Contact your administrator.',409);
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function copy(doc){
 integrity(doc);const final=doc.completed?.payload,signatures=final?.signatures||doc.parties.filter(p=>p.signature).map(p=>({role:p.role,name:p.name,email:p.email,...p.signature}));
 const attestations=signatures.length?signatures.map(s=>'<h3>'+escape(s.name)+' — '+escape(s.role)+'</h3><p>'+escape(s.consent)+'</p><p>'+escape(s.intention)+'</p><p>Email verified at (UTC): '+escape(s.verifiedAt)+'</p>').join(''):'<p>No signatures have been recorded.</p>';
 const rows=signatures.map(s=>'<tr><td>'+escape(s.role)+'</td><td>'+escape(s.name)+'</td><td>'+escape(s.email)+'</td><td>'+escape(s.signedAt)+'</td></tr>').join('');
 const html='<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(doc.title)+'</title><style>body{font:15px/1.6 Arial,sans-serif;color:#182b3a;max-width:850px;margin:32px auto;padding:0 20px}h1{font-size:25px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border:1px solid #ccc;text-align:left;overflow-wrap:anywhere}code{overflow-wrap:anywhere;font-size:11px}.record{border-top:1px solid #ccc;margin-top:30px;padding-top:15px}@media print{body{margin:0;max-width:none}.record{break-before:page}tr{break-inside:avoid}}</style></head><body><h1>'+escape(doc.title)+'</h1><p>'+escape(doc.legalEmployer)+' · '+escape(doc.employeeName)+'<br>Agreement reference: '+escape(doc.id)+' · Effective from: '+escape(doc.effectiveFrom)+'</p><pre>'+escape(doc.body)+'</pre><section class="record"><h2>Electronic signing record</h2><p>Status: '+escape(doc.status)+' · Jurisdiction: '+escape(doc.jurisdiction)+'</p><table><thead><tr><th>Capacity</th><th>Full name</th><th>Verified email</th><th>Signed at (UTC)</th></tr></thead><tbody>'+rows+'</tbody></table>'+attestations+'<p>Verification method: a single-use code delivered to each named signer’s email address. This verifies email access, not government identity or the lawfulness of the agreement.</p><p>Document SHA-256: <code>'+escape(doc.documentHash||hash(source(doc)))+'</code><br>Signing-record SHA-256: <code>'+escape(doc.completed?.hash||doc.events.at(-1)?.hash)+'</code></p><p>Signing records do not certify award compliance or replace any required legal review.</p></section></body></html>';
 return{html,filename:'OpStack-agreement-'+doc.id+'.html',record:doc.completed||{document:source(doc),events:doc.events,signatures}};
}
module.exports={uuid,fail,text,email,canonical,hash,secret,equal,states,consent,intention,signingIntention,normalize,source,append,integrity,copy};
