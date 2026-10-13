(async()=>{
 try{const response=await fetch('/api/session');const session=await response.json();if(!session.csrf){location.href='/login';return;}const admin=document.getElementById('admin-link');if(admin)admin.hidden=session.role!=='admin';const badge=document.getElementById('cart-badge');if(badge){try{const cart=JSON.parse(localStorage.getItem('souvlaki-cart-'+(session.id||session.username))||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}}catch{}
})();
