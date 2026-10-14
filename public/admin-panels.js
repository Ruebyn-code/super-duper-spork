function applyAdminPanels(){
 const defaults={'/admin':'stock','/admin/accounts':'accounts','/admin/settings':'colours'};
 const allowed=[...document.querySelectorAll('.admin-subnav a')].filter(a=>new URL(a.href).pathname===location.pathname).map(a=>new URL(a.href).hash.slice(1));
 let selected=location.hash.slice(1)||defaults[location.pathname];if(selected==='create-account')selected='accounts';if(selected==='email'){selected='locations';history.replaceState(null,'',location.pathname+location.search+'#locations');}if(!allowed.includes(selected))selected=defaults[location.pathname];
 document.querySelectorAll('[data-admin-views]').forEach(element=>{element.hidden=!element.dataset.adminViews.split(' ').includes(selected);});
 document.querySelectorAll('.admin-subnav a').forEach(link=>{const url=new URL(link.href);if(url.pathname===location.pathname&&url.hash==='#'+selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
}
window.addEventListener('hashchange',applyAdminPanels);applyAdminPanels();

document.querySelectorAll('#font-settings>label').forEach(label=>adminUI.wrap(label,label.firstChild.textContent,label.querySelector('select').id,document.getElementById('font-settings')));
document.querySelectorAll('.settings-colours>label').forEach(label=>adminUI.wrap(label,label.firstChild.textContent,label.querySelector('input').id,document.querySelector('.settings-colours')));
for(const [id,title] of [['logo-form','Sign-in / app logo'],['sidebar-logo-form','Sidebar logo'],['signin-background-form','Sign-in background'],['font-upload-form','Font uploads']])adminUI.wrap(document.getElementById(id),title,id);
for(const [id,title] of [['supplier-form','Add supplier']])adminUI.creation(document.getElementById(id),title,id);
// Native validation must be able to reveal and focus fields in closed sections.
document.addEventListener('invalid',event=>{let parent=event.target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);
applyAdminPanels();
