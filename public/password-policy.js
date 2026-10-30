(function(root,factory){const policy=factory();if(typeof module==='object'&&module.exports)module.exports=policy;else root.userPasswordPolicy=policy;})(typeof globalThis==='object'?globalThis:this,()=>{
 const help='Use 15–256 characters. Choose a unique passphrase; spaces are welcome.';
 const compact=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const common=new Set(['password','passphrase','letmein','welcome','qwerty','qwertyuiop','asdfghjkl','zxcvbnm','admin','administrator','changeme','opstack','souvlakigr','iloveyou','thisisapassword','thisismypassword','correcthorsebatterystaple','123456789012345','1234567890123456','12345678901234567890','abcdefghijklmnopqrstuvwxyz']);
 function issue(value,identities=[]){
  if(typeof value!=='string'||value.length>256||Array.from(value).length<15)return 'Use a password of 15–256 characters.';
  const text=compact(value),base=text.replace(/\d+$/,'');
  if(!text||new Set(text).size<4||/^(.{1,128})\1+$/u.test(text)||common.has(text)||common.has(base))return 'Choose a less predictable password. Try several unrelated words.';
  if(identities.some(identity=>{const name=compact(String(identity||'').split('@')[0]);return name.length>=4&&(text===name||base===name);}))return 'Choose a password different from your name or email.';
  return '';
 }
 return{help,issue};
});
