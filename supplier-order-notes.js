// Supplier-specific instructions are part of the order, never supplier settings.
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
function normalize(value,items){
 if(value===undefined)return{};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>500)invalid('Enter valid supplier order notes.');
 const allowed=items&&new Set(items.map(item=>item.supplierId)),entries=Object.entries(value).sort(([a],[b])=>a.localeCompare(b));
 for(const[id,note]of entries)if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||allowed&&!allowed.has(id)||typeof note!=='string'||note.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(note))invalid('Use up to 500 characters of notes for suppliers included in this order.');
 return Object.fromEntries(entries.filter(([,note])=>note.trim()).map(([id,note])=>[id,note.trim()]));
}
function forSupplier(order,id){const specific=Object.hasOwn(order.supplierNotes||{},id)?order.supplierNotes[id]:'';return specific?[order.notes||'',specific].filter(Boolean).join('\n\n'):order.notes;}
module.exports={normalize,forSupplier};
