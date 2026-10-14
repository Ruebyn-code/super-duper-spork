// Shared compact edit rows for administrator screens.
window.adminUI={
 button(label,panelId){
  const button=document.createElement('button');button.type='button';button.className='admin-edit-button';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panelId);
  button.innerHTML='<svg class="admin-pencil" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><g class="icon-detail"><path d="m13 6 5 5M4 16l4 4"/></g></svg><svg class="admin-close" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>';return button;
 },
 set(button,panel,open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));},
 bind(button,panel,group){button.addEventListener('click',()=>{const open=panel.hidden;if(open&&group)for(const other of group.querySelectorAll('.admin-edit-button[aria-expanded=true]')){if(other===button)continue;const target=document.getElementById(other.getAttribute('aria-controls'));if(target)adminUI.set(other,target,false);}adminUI.set(button,panel,open);if(!open)button.focus({preventScroll:true});});},
 wrap(element,title,key,group){
  if(!element)return;const root=document.createElement('div');root.className='admin-setting-row';root.dataset.editId='admin-collapse-'+key;
  if(element.dataset.adminViews){root.dataset.adminViews=element.dataset.adminViews;delete element.dataset.adminViews;}
  const header=document.createElement('div');header.className='admin-record-header';header.dataset.editId='admin-collapse-'+key+'-summary';
  let heading=element.querySelector(':scope>h2,:scope>h3');const previous=element.previousElementSibling;if(!heading&&previous?.tagName==='H3'&&previous.textContent.trim()===title)heading=previous;if(!heading){heading=document.createElement('h3');heading.textContent=title;heading.dataset.editId='admin-collapse-'+key+'-title';}
  const panel=document.createElement('div');panel.className='admin-edit-panel';panel.id='admin-editor-'+key;panel.hidden=true;
  const button=adminUI.button('Edit '+title,panel.id);element.before(root);header.append(heading,button);panel.append(element);root.append(header,panel);adminUI.bind(button,panel,group||root.parentElement);return root;
 },
 creation(element,title,key){
  if(!element)return;const root=document.createElement('div');root.className='admin-create-section';if(element.dataset.adminViews){root.dataset.adminViews=element.dataset.adminViews;delete element.dataset.adminViews;}
  const button=document.createElement('button');button.type='button';button.className='admin-create-button';button.textContent=title;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','admin-create-'+key);
  const panel=document.createElement('div');panel.className='admin-edit-panel admin-create-panel';panel.id='admin-create-'+key;panel.hidden=true;element.before(root);panel.append(element);root.append(button,panel);adminUI.bind(button,panel);return root;
 }
};
document.addEventListener('invalid',event=>{let panel=event.target.closest('.admin-edit-panel');while(panel){const button=document.querySelector('.admin-edit-button[aria-controls="'+panel.id+'"]');if(button)adminUI.set(button,panel,true);panel=panel.parentElement.closest('.admin-edit-panel');}},true);
