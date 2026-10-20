/* A row's primary open action never replaces its links, fields or secondary actions. */
(()=>{
 const interactive='a,button,input,textarea,select,label,summary,[contenteditable],[role=button],[role=combobox]';
 function bind(root,trigger){if(!root||!trigger||trigger.disabled||root.dataset.openTrigger)return;trigger.id||='open-'+crypto.randomUUID();root.dataset.openTrigger=trigger.id;root.tabIndex=0;root.setAttribute('aria-label',trigger.getAttribute('aria-label')||trigger.textContent.trim());}
 function action(event,root){const trigger=document.getElementById(root.dataset.openTrigger);if(!trigger||trigger.disabled||trigger.closest('[hidden],.access-denied,[inert]')||document.body.classList.contains('app-edit-mode')||event.defaultPrevented)return;event.preventDefault();trigger.click();}
 let press=null;
 document.addEventListener('pointerdown',event=>{press={x:event.clientX,y:event.clientY};});
 document.addEventListener('click',event=>{const root=event.target.closest('[data-open-trigger]');if(!root||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const child=event.target.closest(interactive);if(child&&child!==root)return;if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)return;const selection=getSelection();if(selection&&!selection.isCollapsed&&selection.containsNode(root,true))return;action(event,root);});
 document.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||event.target.dataset.openTrigger===undefined||event.ctrlKey||event.metaKey||event.altKey)return;action(event,event.target);});
 function enhance(scope){const buttons=[...(scope.matches?.('.admin-edit-button,[data-edit-stock]')?[scope]:[]),...scope.querySelectorAll('.admin-edit-button,[data-edit-stock]')];for(const button of buttons){const root=button.closest('.user-record,.location-record,.company-record,.admin-record-header,.managed-stock');if(root)bind(root,button);}}
 window.appOpenable={bind};
 function start(){enhance(document);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)enhance(node);}).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
