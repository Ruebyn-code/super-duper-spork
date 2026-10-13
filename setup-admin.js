const readline=require('node:readline');
const {Writable}=require('node:stream');
const path=require('node:path');
const {saveAdmin,saveUser}=require('./auth');
const regular=process.argv.includes('--user');
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
function ask(prompt,secret=false){return new Promise(resolve=>{muted=false;rl.question(prompt,answer=>{muted=false;if(secret)process.stdout.write('\n');resolve(answer);});if(secret)muted=true;});}
(async()=>{try{const username=await ask(regular?'Ordering user name: ':'Administrator username: ');const password=await ask('Password (at least 12 characters; hidden): ',true);const confirmation=await ask('Confirm password: ',true);if(password!==confirmation)throw Error('Passwords do not match.');await (regular?saveUser:saveAdmin)(path.join(__dirname,'data'),username,password);console.log('Account saved. Sign in in the app. Previous sessions for this account are invalidated.');}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}})();
