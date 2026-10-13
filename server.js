const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const menu = [
  {id:'paper',name:'A4 copy paper',category:'Office',price:650,emoji:'📄',description:'500 sheets · 80 gsm',sku:'OFF-001',stock:12},
  {id:'pens',name:'Black ballpoint pens',category:'Office',price:1200,emoji:'🖊️',description:'Box of 12 · medium point',sku:'OFF-002',stock:4},
  {id:'boxes',name:'Shipping boxes',category:'Packaging',price:2800,emoji:'📦',description:'Pack of 25 · 30 × 20 × 15 cm',sku:'PKG-001',stock:8},
  {id:'tape',name:'Packing tape',category:'Packaging',price:1800,emoji:'🧻',description:'Pack of 6 · 48 mm × 50 m',sku:'PKG-002',stock:3},
  {id:'gloves',name:'Nitrile gloves',category:'Safety',price:1500,emoji:'🧤',description:'Box of 100 · medium · powder free',sku:'SAF-001',stock:6},
  {id:'vest',name:'High visibility vest',category:'Safety',price:1400,emoji:'🦺',description:'Each · yellow · one size',sku:'SAF-002',stock:20}
];
function validateOrder(body) {
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || typeof body.location !== 'string' || !body.location.trim() || body.location.length > 200 || typeof body.phone !== 'string' || !/^[+\d ()-]{6,30}$/.test(body.phone) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > menu.length) throw Error('Enter your name, a valid phone number, and at least one item.');
  const seen = new Set();
  const items = body.items.map(item => {
    const product = menu.find(p => p.id === item.id);
    if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw Error('Invalid order items.');
    seen.add(item.id);
    return {id:product.id,name:product.name,quantity:item.quantity,price:product.price};
  });
  return {id:crypto.randomUUID(),name:body.name.trim(),phone:body.phone.trim(),notes:typeof body.notes === 'string' ? body.notes.slice(0,500) : '',items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0),createdAt:new Date().toISOString(),status:'requested',location:typeof body.location === 'string' ? body.location.slice(0,200) : ''};
}
function createServer(dataDir = path.join(__dirname,'data')) {
  return http.createServer(async (req,res) => {
    const json = (code,body) => {res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      if (req.method === 'GET' && req.url === '/api/menu') return json(200,menu);
      if (req.method === 'POST' && req.url === '/api/orders') {
        let raw=''; for await (const chunk of req) {raw+=chunk; if(Buffer.byteLength(raw)>16000) return json(413,{error:'Order is too large.'});}
        let order; try {order=validateOrder(JSON.parse(raw));} catch(error) {return json(400,{error:error.message});}
        await fs.mkdir(dataDir,{recursive:true});
        await fs.writeFile(path.join(dataDir,`${order.id}.json`),JSON.stringify(order,null,2),{flag:'wx',mode:0o600});
        return json(201,order);
      }
      const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
      if (req.method !== 'GET' || !files[req.url]) return json(404,{error:'Not found'});
      const file=files[req.url];
      res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','X-Content-Type-Options':'nosniff'});
      res.end(await fs.readFile(path.join(__dirname,'public',file)));
    } catch {json(500,{error:'Unable to save your order. Please try again.'});}
  });
}
if(require.main===module) createServer().listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Sk Ordering running on port '+(process.env.PORT || 3000)));
module.exports={createServer,validateOrder};
