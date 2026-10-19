(function(root){
 function validate(value){if(typeof value!=='string'||!value.trim()||value.length>100||/[\u0000-\u001f\u007f]/.test(value)||value.split('{user}').length!==2||/\{(?!user\})[^}]*\}/.test(value))throw Error('Enter a greeting of up to 100 characters with {user} exactly once.');return value.trim();}
 function parts(value,username){const [before,after]=validate(value).split('{user}');return{before:before.trimEnd(),name:String(username)+after,text:before+String(username)+after};}
 const api={validate,parts};if(typeof module==='object'&&module.exports)module.exports=api;else root.homeGreetingModel=api;
})(globalThis);
