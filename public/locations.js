(()=>{
 const form=document.getElementById('location-form');if(!form)return;
 const message=document.getElementById('location-message'),list=document.getElementById('location-list');
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 let records=[],users=[],saving=false;
 function disable(value){saving=value;for(const control of document.querySelectorAll('#location-form input,#location-form button,#location-list input,#location-list button'))control.disabled=value;}
 window.renderLocationAdmin=(locations,accounts)=>{
  if(saving)return;records=locations;users=accounts;list.replaceChildren();
  for(const location of locations){
   const row=node('form',undefined,'location-row');row.dataset.editId='location-'+location.id;
   const heading=node('h3',location.name);heading.dataset.userText='';heading.dataset.editId='location-'+location.id+'-name';
   const members=accounts.filter(account=>account.locationId===location.id),status=node('p',undefined,'small');status.dataset.userText='';status.textContent=members.length+' '+wording(members.length===1?'user':'users')+(location.archived?' · '+wording('Archived'):'');
   const label=node('label',wording('Location name')),input=node('input');input.name='name';input.value=location.name;input.maxLength=100;input.required=true;input.dataset.editId='location-'+location.id+'-input';label.dataset.editId='location-'+location.id+'-label';label.append(input);
   const actions=node('div',undefined,'stock-actions'),save=node('button',wording('Save location')),archive=node('button',wording(location.archived?'Restore location':'Archive location'));
   save.type='submit';archive.type='button';archive.disabled=!location.archived&&members.length>0;archive.title=archive.disabled?wording('Move users to another location before archiving.'):'';archive.dataset.requiresEmpty=String(!location.archived&&members.length>0);
   save.dataset.editId='location-'+location.id+'-save';archive.dataset.editId='location-'+location.id+'-archive';status.dataset.editId='location-'+location.id+'-status';
   const manage=node('a',wording('Manage users'));manage.className='header-link';manage.href='/admin/accounts?location='+encodeURIComponent(location.id)+'#accounts';
   const email=node('a',wording('Email settings'));email.className='header-link';email.href='/admin/accounts?location='+encodeURIComponent(location.id)+'#email';
   manage.dataset.editId='location-'+location.id+'-users';email.dataset.editId='location-'+location.id+'-email';actions.dataset.editId='location-'+location.id+'-actions';actions.append(save,archive);if(!location.archived)actions.append(manage,email);const header=node('div',undefined,'admin-record-header'),info=node('div',undefined,'admin-record-info'),panel=node('div',undefined,'admin-edit-panel');panel.id='location-editor-'+location.id;panel.hidden=true;const edit=adminUI.button('Edit location '+location.name,panel.id);adminUI.bind(edit,panel,list);info.append(heading,status);header.append(info,edit);panel.append(label,actions);row.append(header,panel);
   row.onsubmit=event=>{event.preventDefault();change(location.id,{name:input.value});};
   archive.onclick=()=>{if(!location.archived&&!confirm(wording('Archive this location? Its saved records and email settings will be kept.')))return;change(location.id,{name:location.name,archived:!location.archived});};
   list.append(row);
  }
 };
 async function change(id,body){
  if(saving)return;disable(true);message.textContent=wording('Saving location…');
  try{await api('/api/locations/'+id,'PUT',body);disable(false);await loadAccounts();message.textContent=wording('Location saved.');}
  catch(error){message.textContent=error.message;}
  finally{disable(false);list.querySelectorAll('[data-requires-empty=true]').forEach(button=>button.disabled=true);}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const name=form.elements.name.value;disable(true);message.textContent=wording('Creating location…');
  try{await api('/api/locations','POST',{name});form.reset();disable(false);await loadAccounts();message.textContent=wording('Location created. Assign its users and set its email sender.');}
  catch(error){message.textContent=error.message;}
  finally{disable(false);list.querySelectorAll('[data-requires-empty=true]').forEach(button=>button.disabled=true);}
 };
 window.addEventListener('interface-text-updated',()=>window.renderLocationAdmin(records,users));
})();
