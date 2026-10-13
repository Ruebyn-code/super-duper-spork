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
function validateOrder(body, menu) {
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || typeof body.location !== 'string' || !body.location.trim() || body.location.length > 200 || typeof body.phone !== 'string' || !/^[+\d ()-]{6,30}$/.test(body.phone) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > menu.length) throw Error('Enter your name, a valid phone number, and at least one item.');
  const seen = new Set();
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object') throw Error('Invalid order items.');
    const product = menu.find(p => p.id === item.id);
    if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw Error('Invalid order items.');
    seen.add(item.id);
    return {id:product.id,name:product.name,supplier:product.supplier,quantity:item.quantity,price:product.price};
  });
  return {id:crypto.randomUUID(),name:body.name.trim(),phone:body.phone.trim(),notes:typeof body.notes === 'string' ? body.notes.slice(0,500) : '',items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0),createdAt:new Date().toISOString(),status:'requested',location:typeof body.location === 'string' ? body.location.slice(0,200) : ''};
}
function createServer(dataDir = path.join(__dirname,'data')) {
  const catalogueFile = path.join(dataDir,'catalogue.json');
  let pending = Promise.resolve();
  async function readCatalogue() {
    try { return JSON.parse(await fs.readFile(catalogueFile,'utf8')); }
    catch (error) { if(error.code !== 'ENOENT') throw error;
      return {suppliers:[{id:'office',name:'Office Supplies'},{id:'packaging',name:'Packaging Supplies'},{id:'safety',name:'Safety Supplies'}],products:menu.map(p=>({...p,supplierId:p.category.toLowerCase()}))};
    }
  }
  function mutate(change) {
    const operation=pending.then(async()=>{
      const catalogue=await readCatalogue();const result=change(catalogue);
      await fs.mkdir(dataDir,{recursive:true});
      const temp=catalogueFile+'.tmp';await fs.writeFile(temp,JSON.stringify(catalogue,null,2),{mode:0o600});await fs.rename(temp,catalogueFile);return result;
    });pending=operation.catch(()=>{});return operation;
  }
  function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
  async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)fail('Request is too large.',413);}try{return JSON.parse(raw);}catch{fail('Invalid JSON.');}}
  function name(value,label,max=100){if(typeof value !== 'string'||!value.trim()||value.length>max)fail('Enter a valid '+label+'.');return value.trim();}
  return http.createServer(async (req,res) => {
    const json = (code,body) => {res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      if (req.method === 'GET' && ['/api/menu','/api/catalogue'].includes(req.url)) {
        const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        return json(200,req.url==='/api/menu'?products:{...catalogue,products});
      }
      if(req.method==='POST' && req.url==='/api/suppliers'){
        const input=await body(req);const supplierName=name(input?.name,'supplier name');
        return json(201,await mutate(c=>{if(c.suppliers.some(s=>s.name.toLowerCase()===supplierName.toLowerCase()))fail('That supplier already exists.');const supplier={id:crypto.randomUUID(),name:supplierName};c.suppliers.push(supplier);return supplier;}));
      }
      if(req.method==='POST' && req.url==='/api/products'){
        const input=await body(req);const productName=name(input?.name,'stock name');
        if(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>1000000||!Number.isInteger(input.stock)||input.stock<0||input.stock>1000000)fail('Enter a valid price and whole-number stock quantity.');
        const product={id:crypto.randomUUID(),name:productName,supplierId:input.supplierId,price:Math.round(input.price*100),stock:input.stock,category:name(input.category||'General','category',60),sku:typeof input.sku==='string'?input.sku.trim().slice(0,60):'',description:typeof input.description==='string'?input.description.slice(0,300):'',emoji:'📦'};
        return json(201,await mutate(c=>{if(!c.suppliers.some(s=>s.id===product.supplierId))fail('Choose an existing supplier.');c.products.push(product);return product;}));
      }
      const deletion=req.url.match(/^\/api\/(products|suppliers)\/([a-zA-Z0-9-]+)$/);
      if(req.method==='DELETE' && deletion){return json(200,await mutate(c=>{
        const collection=deletion[1];const id=deletion[2];if(!c[collection].some(item=>item.id===id))fail('Item not found.',404);
        if(collection==='suppliers'&&c.products.some(p=>p.supplierId===id))fail('Remove this supplier’s stock before removing the supplier.');
        c[collection]=c[collection].filter(item=>item.id!==id);return {removed:true};
      }));}
      if (req.method === 'POST' && req.url === '/api/orders') {
        const input=await body(req);const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        let order;try{order=validateOrder(input,products);}catch(error){fail(error.message);}
        await fs.mkdir(dataDir,{recursive:true});
        await fs.writeFile(path.join(dataDir,`${order.id}.json`),JSON.stringify(order,null,2),{flag:'wx',mode:0o600});
        return json(201,order);
      }
      const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
      if (req.method !== 'GET' || !files[req.url]) return json(404,{error:'Not found'});
      const file=files[req.url];
      res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','X-Content-Type-Options':'nosniff'});
      res.end(await fs.readFile(path.join(__dirname,'public',file)));
    } catch(error) {json(error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});}
  });
}
if(require.main===module) createServer().listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Sk Ordering running on port '+(process.env.PORT || 3000)));
module.exports={createServer,validateOrder};
