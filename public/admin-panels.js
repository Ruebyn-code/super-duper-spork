function applyAdminPanels(){
 const defaults={'/admin':'stock','/admin/accounts':'accounts','/admin/settings':'colours','/email-settings':'email'};
 const allowed=[...document.querySelectorAll('.admin-subnav a')].filter(a=>new URL(a.href).pathname===location.pathname).map(a=>new URL(a.href).hash.slice(1));
 let selected=location.hash.slice(1)||defaults[location.pathname];if(!allowed.includes(selected))selected=defaults[location.pathname];
 document.querySelectorAll('[data-admin-views]').forEach(element=>{const wasHidden=element.hidden;const shouldShow=element.dataset.adminViews.split(' ').includes(selected);element.hidden=!shouldShow;if(wasHidden&&shouldShow){element.classList.remove('panel-enter');requestAnimationFrame(()=>element.classList.add('panel-enter'));}});
 document.querySelectorAll('.admin-subnav a').forEach(link=>{const url=new URL(link.href);if(url.pathname===location.pathname&&url.hash==='#'+selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
}
window.addEventListener('hashchange',applyAdminPanels);applyAdminPanels();

// Keep existing controls and their identities inside independently collapsible sections.
function makeAdminSection(element,title,key){
 if(!element)return null;
 const menu=document.createElement('details');menu.className='admin-collapse';menu.dataset.editId='admin-collapse-'+key;
 if(element.dataset.adminViews)menu.dataset.adminViews=element.dataset.adminViews;
 const summary=document.createElement('summary');summary.dataset.editId='admin-collapse-'+key+'-summary';
 const content=document.createElement('div');content.className='admin-collapse-content';
 element.before(menu);
 if(typeof title==='string'){const heading=document.createElement('h3');heading.textContent=title;heading.dataset.editId='admin-collapse-'+key+'-title';summary.append(heading);}else summary.append(title);
 content.append(element);menu.append(summary,content);return menu;
}
document.querySelectorAll('#font-settings>label').forEach(label=>makeAdminSection(label,label.firstChild.textContent,label.querySelector('select').id));
const emailForm=document.getElementById('email-form');if(emailForm){const labels=[...emailForm.children].filter(e=>e.tagName==='LABEL');for(const [index,title] of ['Automatic order emails','Sender email','Sending credentials'].entries())makeAdminSection(labels[index],title,'email-'+index);}
// Native validation must be able to reveal and focus fields in closed sections.
document.addEventListener('invalid',event=>{let parent=event.target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);
applyAdminPanels();
