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
})();
