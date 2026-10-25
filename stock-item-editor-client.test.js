const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const countUnits=require('./public/stock-count-units');
function editor(){
 const elements=new Map();let active=null;
 function node(id,dataset={}){const listeners=new Map(),attributes=new Map();const element={id,dataset,value:'',disabled:false,hidden:false,textContent:'',tabIndex:0,open:false,
  addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},
  fire(type,event={}){for(const listener of listeners.get(type)||[])listener({target:element,...event});},
  setAttribute(key,value){attributes.set(key,value);},getAttribute(key){return attributes.get(key);},focus(){active=element;},setCustomValidity(value){this.validationMessage=value;},closest(){return this.panel;}
 };elements.set(id,element);return element;}
 const tabs=['details','counting','ordering'].map(key=>node('stock-tab-'+key,{stockTab:key})),panels=['details','counting','ordering'].map(key=>node('stock-panel-'+key,{stockPanel:key}));
 const name=node('name'),ratio=node('ratio'),itemName=node('itemName'),cutoff=node('cutoff');name.panel=ratio.panel=panels[1];itemName.panel=panels[0];cutoff.panel=panels[2];cutoff.disabled=true;
 const preview=node('stock-count-unit-preview'),message=node('stock-editor-message');node('stock-photo-options');node('stock-photo-preview').hidden=true;
 const form=node('stock-form');form.elements=Object.assign([name,ratio,itemName,cutoff,...tabs],{countUnitName:name,countUnitsPerUnit:ratio});form.querySelectorAll=selector=>selector==='[data-stock-tab]'?tabs:selector==='[data-stock-panel]'?panels:[];
 const window=node('window'),document={getElementById:id=>elements.get(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('./public/stock-item-editor.js'),'utf8'),{window,document,stockCountUnits:countUnits,Intl,setTimeout});
 const api=window.stockItemEditor;api.reset();return{api,window,form,tabs,panels,name,ratio,itemName,cutoff,preview,message,active:()=>active};
}

test('stock editor tabs preserve the same inputs and support arrow/Home/End keyboard navigation',()=>{
 const e=editor();e.itemName.value='Small chip cups';e.name.value='Sleeves';e.ratio.value='20';e.name.fire('input');
 e.tabs[0].fire('keydown',{key:'ArrowRight',preventDefault(){}});assert.equal(e.tabs[1].getAttribute('aria-selected'),'true');assert.equal(e.active(),e.tabs[1]);assert.equal(e.panels[0].hidden,true);assert.equal(e.panels[1].hidden,false);
 e.tabs[1].fire('keydown',{key:'End',preventDefault(){}});assert.equal(e.active(),e.tabs[2]);e.tabs[2].fire('keydown',{key:'Home',preventDefault(){}});assert.equal(e.active(),e.tabs[0]);
 assert.equal(e.itemName.value,'Small chip cups');assert.equal(e.name.value,'Sleeves');assert.equal(e.ratio.value,'20');assert.equal(e.name.disabled,false);assert.equal(e.ratio.disabled,false);
});

test('stock counting setup validates incomplete pairs and shows sleeve-to-pack examples without writes',()=>{
 const e=editor();assert.match(e.preview.textContent,/Count using the ordered unit/);e.name.value='Sleeves';e.name.fire('input');assert.match(e.ratio.validationMessage,/how many/);
 e.ratio.value='20';e.ratio.fire('input');assert.equal(e.ratio.validationMessage,'');assert.match(e.preview.textContent,/1 ordered unit = 20 Sleeves/);assert.match(e.preview.textContent,/Counting 10 Sleeves records 0.5/);
 e.name.value='';e.name.fire('input');assert.match(e.name.validationMessage,/counting unit name/);e.ratio.value='';e.ratio.fire('input');assert.equal(e.name.validationMessage,'');assert.equal(e.ratio.validationMessage,'');
});

test('one native validation pass keeps the first invalid field visible across browser microtask checkpoints',async()=>{
 const e=editor();e.api.select('ordering');e.form.fire('invalid',{target:e.itemName});assert.equal(e.panels[0].hidden,false);
 await Promise.resolve();e.form.fire('invalid',{target:e.ratio});assert.equal(e.panels[0].hidden,false);assert.equal(e.panels[1].hidden,true);
 await new Promise(resolve=>setTimeout(resolve,0));e.form.fire('invalid',{target:e.ratio});assert.equal(e.panels[1].hidden,false);
});

test('pending stock saves freeze tabs and context switching, then restore rule-specific disabled fields and drafts',()=>{
 const e=editor();e.api.select('ordering');e.name.value='Sleeves';e.ratio.value='20';e.api.setBusy(true);assert.equal(e.api.busy,true);assert(e.form.elements.every(control=>control.disabled));
 e.api.select('details');assert.equal(e.panels[2].hidden,false);let vetoed=false;e.window.fire('before-location-switch',{preventDefault(){vetoed=true;}});assert.equal(vetoed,true);
 e.api.setBusy(false);assert.equal(e.api.busy,false);assert.equal(e.cutoff.disabled,true);assert.equal(e.name.disabled,false);assert.equal(e.ratio.value,'20');assert.equal(e.name.value,'Sleeves');e.api.select('counting');assert.equal(e.panels[1].hidden,false);
 vetoed=false;e.window.fire('before-location-switch',{preventDefault(){vetoed=true;}});assert.equal(vetoed,false);
});
