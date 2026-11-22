const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(company){
 const listeners={};const window={addEventListener:(type,fn)=>{(listeners[type]||(listeners[type]=[])).push(fn);},appAccess:{initialSession:async()=>({companyName:company,locationName:'Richmond'})}};
 const context={window,document:{documentElement:{}},location:{host:'opstack.example.test'},fetch:async()=>({ok:false,headers:{get:()=>null}}),getComputedStyle:()=>({getPropertyValue:()=>'#0057ff'}),FileReader:class{},btoa:value=>Buffer.from(value,'binary').toString('base64'),Intl,Date,setTimeout,console};
 vm.runInNewContext(fs.readFileSync(require.resolve('./public/print-branding.js'),'utf8'),context);return window.printBranding;
}
test('printed pages get primary-tinted bars with the owner, page n of N and the OpStack address; names are escaped',async()=>{
 const branding=load('Souvlaki "GR"');await branding.ready();
 const css=branding.pageCss('Stock "transfers"');
 assert.match(css,/@bottom-left\{content:"This PDF is the property of Souvlaki \\"GR\\""/);
 assert.match(css,/counter\(page\) " of " counter\(pages\)/);
 assert.match(css,/@bottom-right\{content:"opstack\.example\.test  "/);
 assert.match(css,/@top-left\{content:"Stock \\"transfers\\""/);
 assert.match(css,/@page:first\{@top-left-corner\{content:none\}/,'the first page shows the full header instead of the slim bar');
 assert.equal(branding.tint(0.1),'rgb(230,238,255)','the bars use a light tint of the company primary');
 assert.doesNotMatch(branding.pageCss('a\nb'),/a\nb/);
});
