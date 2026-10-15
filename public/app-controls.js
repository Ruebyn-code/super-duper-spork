// Share the same account actions between the blue desktop button and mobile More tab.
window.createAppControls=({footer,toggle,mobile,wording,beforeOpen})=>{
 const create=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const icon=body=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);svg.classList.add('sidebar-navigation-icon');svg.innerHTML=body;return svg;};
 const userIcon='<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/><g class="icon-detail"><path d="M10 18h4"/></g>';
 const settingsIcon='<rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M6 8h12M6 16h12"/><circle cx="9" cy="8" r="2"/><circle cx="15" cy="16" r="2"/></g>';
 const logout=document.getElementById('logout'),editControls=document.getElementById('admin-edit-controls'),editButton=document.getElementById('app-edit-toggle');
 const trigger=create('button','toolbar-toggle');trigger.id='toolbar-toggle';trigger.type='button';trigger.dataset.layoutUi='';trigger.append(icon(userIcon),icon('<path d="m8 10 4 4 4-4"/>'));trigger.lastChild.classList.add('account-menu-chevron');
 const menu=create('div','app-controls-menu');menu.id='app-controls-menu';menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.dataset.layoutUi='';menu.dataset.copyEditor='';
 const identity=create('div','account-menu-identity'),avatar=create('span','account-menu-avatar'),identityText=create('div'),name=create('strong'),permission=create('span');for(const node of [avatar,name,permission])node.dataset.userText='';identityText.append(name,permission);identity.append(avatar,identityText);
 const profileButton=create('button','account-menu-item');profileButton.id='user-profile-link';profileButton.type='button';profileButton.disabled=true;profileButton.setAttribute('role','menuitem');profileButton.append(icon(userIcon),create('span','account-menu-label','User profile'));
 const settingsLink=create('a','account-menu-item');settingsLink.id='account-settings-link';settingsLink.href='/admin/settings#colours';settingsLink.hidden=true;settingsLink.setAttribute('data-head-office-only','');settingsLink.setAttribute('role','menuitem');settingsLink.append(icon(settingsIcon),create('span','account-menu-label','App settings'));
 menu.append(identity,profileButton,settingsLink);if(editControls){editControls.hidden=true;menu.append(editControls);}if(editButton){editButton.classList.add('account-menu-item');editButton.setAttribute('role','menuitem');}
 if(logout){logout.classList.add('account-menu-item','account-menu-signout');logout.setAttribute('role','menuitem');menu.append(logout);}
 if(toggle)footer.after(toggle);footer.append(trigger);footer.classList.add('account-menu-footer');document.body.append(menu);
 const profile=create('dialog','user-profile-dialog');profile.id='user-profile-dialog';profile.setAttribute('aria-labelledby','user-profile-title');profile.dataset.layoutUi='';
 const profileHeader=create('div','user-profile-heading'),profileTitle=create('h2',undefined,'User profile'),profileClose=create('button','user-profile-close');profileTitle.id='user-profile-title';profileClose.type='button';profileClose.append(icon('<path d="m6 6 12 12M18 6 6 18"/>'));profileClose.autofocus=true;profileHeader.append(profileTitle,profileClose);
 const profileIdentity=create('div','user-profile-identity'),profileAvatar=create('span','account-menu-avatar'),profileName=create('h3'),profileRole=create('p'),profileText=create('div');for(const node of [profileAvatar,profileName,profileRole])node.dataset.userText='';profileText.append(profileName,profileRole);profileIdentity.append(profileAvatar,profileText);
 const details=create('dl','user-profile-details'),values={};for(const [key,label] of [['company','Company'],['location','Current location'],['companies','Companies you can access'],['locations','Locations in this company']]){const row=create('div'),title=create('dt',undefined,label),value=create('dd');value.dataset.userText='';values[key]=value;row.append(title,value);details.append(row);}profile.append(profileHeader,profileIdentity,details);document.body.append(profile);
 let mobileTrigger,session,pointerWasOpen=false;
 const anchor=()=>mobile.matches&&mobileTrigger?mobileTrigger:trigger,opened=()=>menu.matches(':popover-open');
 function refresh(){
  const expanded=String(opened());for(const button of [trigger,mobileTrigger].filter(Boolean)){button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded',expanded);}
  trigger.title=wording('Account menu');trigger.setAttribute('aria-label',trigger.title);menu.setAttribute('aria-label',wording('Account menu'));mobileTrigger?.classList.toggle('active',opened());
  profileClose.setAttribute('aria-label',wording('Close profile'));profileClose.title=wording('Close profile');
  for(const [element,text] of [[profileButton.querySelector('span'),'User profile'],[settingsLink.querySelector('span'),'App settings'],[profileTitle,'User profile']]){const label=wording(text);if(element.textContent!==label)element.textContent=label;}
  if(session){const role=wording({admin:'Head Office',franchisee:'Franchisee',user:'Ordering manager'}[session.role]||session.role);permission.textContent=profileRole.textContent=role;}
  if(location.pathname==='/admin/settings')settingsLink.setAttribute('aria-current','page');else settingsLink.removeAttribute('aria-current');
 }
 function position(){
  if(!opened())return;const box=anchor().getBoundingClientRect(),viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,edge=12,menuWidth=Math.min(272,width-edge*2),below=top+height-box.bottom-edge,above=box.top-top-edge,down=!mobile.matches&&below>=Math.min(300,above),room=Math.max(80,down?below:above);
  menu.style.width=menuWidth+'px';menu.style.maxHeight=Math.min(440,room-6)+'px';menu.style.left=Math.max(left+edge,Math.min(box.right-menuWidth,left+width-menuWidth-edge))+'px';menu.style.top=down?(box.bottom+6)+'px':'auto';menu.style.bottom=down?'auto':Math.max(edge,innerHeight-box.top+6)+'px';
 }
 function close(restoreFocus=false){if(opened())menu.hidePopover();refresh();if(restoreFocus)anchor().focus({preventScroll:true});}
 const items=()=>[...menu.querySelectorAll('[role=menuitem]')].filter(item=>!item.disabled&&item.getClientRects().length);
 function open(focus=false,last=false){beforeOpen?.();menu.showPopover();position();refresh();if(focus)(last?items().at(-1):items()[0])?.focus();}
 function toggleMenu(event){if(opened()||(event.detail>0&&pointerWasOpen))close();else open(event.detail===0);pointerWasOpen=false;}
 function triggerKeys(event){if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();open(true,event.key==='ArrowUp');}
 trigger.onclick=toggleMenu;trigger.onpointerdown=()=>{pointerWasOpen=opened();};trigger.onkeydown=triggerKeys;menu.addEventListener('toggle',refresh);
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}if(event.key==='Tab'){close(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const links=items(),current=links.indexOf(document.activeElement);links[event.key==='Home'?0:event.key==='End'?links.length-1:(current+(event.key==='ArrowUp'?-1:1)+links.length)%links.length]?.focus();});
 menu.addEventListener('click',event=>{if(event.target.closest('[role=menuitem]'))close();});
 profileButton.onclick=()=>{if(!session)return;close();profile.showModal();};profileClose.onclick=()=>profile.close();profile.addEventListener('close',()=>anchor().focus({preventScroll:true}));profile.addEventListener('click',event=>{if(event.target!==profile)return;const box=profile.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)profile.close();});
 window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);document.addEventListener('scroll',position,{capture:true,passive:true});
 function setSession(value){
  session=value;const role={admin:'Head Office',franchisee:'Franchisee',user:'Ordering manager'}[value.role]||value.role,initials=value.username.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase();
  name.textContent=profileName.textContent=value.username;permission.textContent=profileRole.textContent=wording(role);avatar.textContent=profileAvatar.textContent=initials;values.company.textContent=value.companyName||'—';values.location.textContent=value.locationName||'—';
  for(const [key,entries] of [['companies',value.companies],['locations',value.locations]]){values[key].replaceChildren();values[key].className='user-profile-tags';for(const entry of entries||[])values[key].append(create('span',undefined,entry.name));if(!values[key].childNodes.length)values[key].textContent='—';}
  settingsLink.hidden=value.role!=='admin';if(editControls)editControls.hidden=value.role!=='admin';profileButton.disabled=false;refresh();
 }
 refresh();return {close,setSession,refresh,setMobileTrigger(button){mobileTrigger=button;button.dataset.layoutUi='';button.onclick=toggleMenu;button.onpointerdown=()=>{pointerWasOpen=opened();};button.onkeydown=triggerKeys;refresh();},sync(){close();}};
};
