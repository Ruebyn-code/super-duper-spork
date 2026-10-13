function applyAdminPanels(){
 const defaults={'/admin':'stock','/admin/accounts':'accounts','/admin/settings':'colours','/email-settings':'email'};
 const allowed=[...document.querySelectorAll('.admin-subnav a')].filter(a=>new URL(a.href).pathname===location.pathname).map(a=>new URL(a.href).hash.slice(1));
 let selected=location.hash.slice(1)||defaults[location.pathname];if(!allowed.includes(selected))selected=defaults[location.pathname];
 document.querySelectorAll('[data-admin-views]').forEach(element=>{element.hidden=!element.dataset.adminViews.split(' ').includes(selected);});
 document.querySelectorAll('.admin-subnav a').forEach(link=>{const url=new URL(link.href);if(url.pathname===location.pathname&&url.hash==='#'+selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
}
window.addEventListener('hashchange',applyAdminPanels);applyAdminPanels();
