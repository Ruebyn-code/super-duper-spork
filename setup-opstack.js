const readline=require('node:readline'),{Writable}=require('node:stream');
const {dataDirectory}=require('./runtime-config'),{createStore}=require('./opstack-store');
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
const ask=(prompt,secret=false)=>new Promise(resolve=>{muted=false;rl.question(prompt,answer=>{muted=false;if(secret)process.stdout.write('\n');resolve(answer);});if(secret)muted=true;});
(async()=>{try{
 const store=createStore(dataDirectory());if(await store.enabled())throw Error('An Opstack owner already exists. Use the Opstack console to invite more owners or support accounts.');
 const username=await ask('Opstack owner name: '),email=await ask('Opstack owner email: '),password=await ask('Password (12+ characters; hidden): ',true),confirm=await ask('Confirm password: ',true);
 if(password!==confirm)throw Error('Passwords do not match.');await store.initialOwner({username,email,password});
 console.log('Opstack owner created. Open your app URL followed by /opstack and sign in. Existing users and network data are unchanged.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}})();
