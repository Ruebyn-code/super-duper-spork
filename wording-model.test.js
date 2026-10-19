const {test}=require('node:test'),assert=require('node:assert/strict');
const wording=require('./public/wording-model');

test('only original interface copy receives wording sources; values and editable content remain data',()=>{
 const input='<main><h2>Sales</h2><label>Amount<input value="Sales" placeholder="Sales" title="Sales"></label><strong data-user-text>Sales</strong><textarea>Sales</textarea><select><option>Sales</option></select><div contenteditable="true">Sales</div><script>const label="<h2>Sales</h2>";</script><p>Sales &amp; costs</p></main>';
 const result=wording.annotate(input,['Sales','Amount','Sales & costs']);
 assert.match(result,/<h2 data-interface-copy=/);
 assert.match(result,/<input value="Sales" placeholder="Sales" title="Sales" data-interface-attributes=/);
 for(const literal of ['<strong data-user-text>Sales</strong>','<textarea>Sales</textarea>','<option>Sales</option>','<div contenteditable="true">Sales</div>','const label="<h2>Sales</h2>";'])assert.ok(result.includes(literal));
 assert.match(result,/Sales%20%26%20costs/);
 assert.ok(!result.includes('value="Revenue"'));
});

test('matching text alone is never a wording source, and externally changed text is not reinterpreted as another label',()=>{
 const element=(dataset={})=>({dataset,closest:()=>null,getAttribute:()=>null,textContent:'Sales'});
 const generated={nodeValue:'Sales',parentElement:element()};assert.equal(wording.source(generated),null);
 const label={nodeValue:'Sales',parentElement:element({interfaceCopy:encodeURIComponent(JSON.stringify(['Sales']))})};assert.equal(wording.source(label).key,'Sales');
 label.nodeValue='Revenue';assert.equal(wording.source(label,{source:'Sales',key:'Sales',rendered:'Revenue'}).key,'Sales');
 label.nodeValue='Cart';assert.equal(wording.source(label,{source:'Sales',key:'Sales',rendered:'Revenue'}),null);
 const data={nodeValue:'Sales',parentElement:{dataset:{interfaceCopy:encodeURIComponent('["Sales"]')},closest:()=>({})}};assert.equal(wording.source(data),null);
});

test('declared templates protect interpolated values and stale templates do not overwrite validation or status text',()=>{
 const parent={dataset:{appTemplate:'Hello {user}',appValues:JSON.stringify({user:'Sales'})},closest:()=>null};
 const node={nodeValue:'Hello Sales',parentElement:parent},source=wording.source(node);assert.equal(source.key,'Hello {user}');assert.equal(source.values.user,'Sales');
 node.nodeValue='Unable to load';assert.equal(wording.source(node),null);
 const attributes={placeholder:'Sales',value:'Sales'},input={dataset:{interfaceAttributes:encodeURIComponent(JSON.stringify({placeholder:'Sales'}))},closest:()=>null,getAttribute:key=>attributes[key]};
 assert.equal(wording.attribute(input,'placeholder'),'Sales');assert.equal(wording.attribute(input,'value'),null);
 attributes.placeholder='New input';assert.equal(wording.attribute(input,'placeholder',{source:'Sales',rendered:'Revenue'}),null);
});
