(()=>{
 const model=window.aiBrandModel;if(!model)return;
 let value=null;
 function apply(next,broadcast=true){
  if(!next||next.companyId!==window.appCompanyId||!Number.isInteger(next.revision)||next.revision<0||value&&next.revision<value.revision)return false;
  value={companyId:next.companyId,revision:next.revision,...model.settings(next)};
  let style=document.getElementById('ai-brand-style');if(!style){style=document.createElement('style');style.id='ai-brand-style';document.head.append(style);}style.textContent=model.css(value);
  if(window.appBootstrap)window.appBootstrap.aiBrand={...value};
  if(broadcast){
   if(parent!==window&&parent.appShell&&parent.appCompanyId===value.companyId)parent.opstackIntelligenceBrand?.apply(value);
   for(const frame of document.querySelectorAll('iframe.shell-page-frame')){const child=frame.contentWindow;if(child?.appCompanyId===value.companyId)child.opstackIntelligenceBrand?.apply(value,false);}
  }
  return true;
 }
 window.opstackIntelligenceBrand={apply,get value(){return value&&{...value};}};
 try{apply((window.appBootstrap||JSON.parse(document.getElementById('app-bootstrap').textContent)).aiBrand);}catch{}
 // Touch browsers do not always retain :active inside the content frame.
 // This marker adds visual feedback only; ordinary clicks keep their own handlers.
 const pressed=new Map();
 function release(id){const target=pressed.get(id);pressed.delete(id);if(target&&![...pressed.values()].includes(target))target.removeAttribute('data-ai-pressed');}
 function releaseAll(){for(const id of [...pressed.keys()])release(id);}
 document.addEventListener('pointerdown',event=>{if(event.button!==0)return;const target=event.target.closest?.('button,a,input,textarea,select,summary,.app-search-control,.app-search-panel,.ai-draft-dialog,.scheduled-dialog,.ai-settings,.settings-option,.ai-source-list,.ai-question-types,.ai-source-text,.ai-planner-preview,.ai-question-preview,.scheduled-card,.scheduled-choice-group,.ai-settings-usage,.ai-brand-preview,.ai-palette-choice');if(!target||target.matches(':disabled,[aria-disabled=true]')||target.matches('.ai-palette-choice:has(>input:disabled)')||!getComputedStyle(target).getPropertyValue('--ai-glow-shadow'))return;release(event.pointerId);pressed.set(event.pointerId,target);target.setAttribute('data-ai-pressed','');},{passive:true});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,event=>release(event.pointerId),{passive:true,capture:true});
 document.addEventListener('pointerout',event=>{const target=pressed.get(event.pointerId);if(target&&!target.contains(event.relatedTarget))release(event.pointerId);},{passive:true});
 window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
})();
