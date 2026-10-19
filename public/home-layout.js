/* Home controls live inside the shared App edit dialog, never in a second menu. */
(()=>{
 const model=window.homeLayoutModel;if(!model)return;
 const $=id=>document.getElementById(id);
 const style=document.createElement('style');style.id='home-layout-style';document.head.append(style);
 function apply(overrides){const css=model.css(overrides?.['home-main']?.homeLayout);if(style.textContent!==css)style.textContent=css;}
 function attach(dialog){
  const tab=document.createElement('button');tab.type='button';tab.id='editor-home-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','editor-home-panel');tab.tabIndex=-1;tab.textContent='Home layout';dialog.querySelector('.editor-tabs').append(tab);
  const panel=document.createElement('div');panel.id='editor-home-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.hidden=true;
  panel.innerHTML='<p class="home-layout-hint">Saved for everyone in this company. Hold and drag sections or cards on Home to rearrange them. Hidden cards appear faded while App edit is on. Permissions still apply.</p><section class="editor-section"><h3>Layout &amp; spacing</h3><div class="home-layout-options" id="home-layout-options"></div></section><section class="editor-section"><h3>Details</h3><div class="home-layout-switches" id="home-layout-details"></div></section><div id="home-layout-widgets"></div><section class="editor-section"><button id="home-layout-reset" class="editor-reset" type="button">Reset layout options</button><p class="home-layout-hint">Keeps your wording, colours, fonts, images and card order.</p></section>';
  dialog.querySelector('.app-editor-body').append(panel);
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  function select(key,caption,options){const label=node('label',caption),input=node('select');input.id='home-layout-'+key;for(const [value,text] of options){const option=node('option',text);option.value=value;input.append(option);}label.append(input);$('home-layout-options').append(label);}
  select('density','Density',[['compact','Compact'],['comfortable','Comfortable']]);
  select('columns','Quick link columns',[2,3,4,5,6].map(value=>[value,String(value)]));
  select('width','Page width',[['full','Full width'],['1200','1,200 px'],['1440','1,440 px']]);
  select('shortcutStyle','Quick link style',[['cards','Cards'],['list','List']]);
  for(const [key,caption,min,max] of [['gap','Spacing',6,24],['radius','Corners',0,24]]){const label=node('label',caption),output=node('output'),input=node('input');input.type='range';input.id='home-layout-'+key;input.min=min;input.max=max;input.step=1;output.htmlFor=input.id;input.oninput=()=>output.textContent=input.value+' px';label.append(output,input);$('home-layout-options').append(label);}
  function checkbox(parent,id,caption){const label=node('label'),input=node('input');input.type='checkbox';input.id=id;label.append(input,node('span',caption));parent.append(label);return input;}
  for(const [key,caption] of [['descriptions','Quick link descriptions'],['periods','Metric date labels'],['notes','Calculation notes']])checkbox($('home-layout-details'),'home-layout-'+key,caption);
  for(const [caption,widgets] of [['Sections',model.sections],['Quick links',model.shortcuts],['Individual metrics',model.metrics]]){const section=node('section');section.className='editor-section';section.append(node('h3',caption));const list=node('div');list.className='home-layout-switches';for(const [id,name] of Object.entries(widgets))checkbox(list,'home-widget-'+id,name).dataset.homeWidget=id;section.append(list);$('home-layout-widgets').append(section);}
  function fill(overrides){const value=model.validate(overrides?.['home-main']?.homeLayout||{});for(const key of ['density','columns','width','shortcutStyle','gap','radius'])$('home-layout-'+key).value=value[key];for(const key of ['gap','radius'])$('home-layout-'+key).oninput();for(const key of ['descriptions','periods','notes'])$('home-layout-'+key).checked=value[key];for(const input of panel.querySelectorAll('[data-home-widget]'))input.checked=!value.hidden.includes(input.dataset.homeWidget);}
  function value(){const result={};for(const key of ['density','width','shortcutStyle'])result[key]=$('home-layout-'+key).value;for(const key of ['columns','gap','radius'])result[key]=Number($('home-layout-'+key).value);for(const key of ['descriptions','periods','notes'])result[key]=$('home-layout-'+key).checked;result.hidden=[...panel.querySelectorAll('[data-home-widget]')].filter(input=>!input.checked).map(input=>input.dataset.homeWidget);return model.validate(result);}
  $('home-layout-reset').onclick=()=>fill({});
  return {fill,value};
 }
 window.homeDashboard={apply,attach};
 $('home-customise').onclick=()=>window.appEditor?.openHomeLayout();
})();
