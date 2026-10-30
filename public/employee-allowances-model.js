(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.employeeAllowances=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 const choices=[
  {id:'laundry',label:'Uniform laundry',automatic:true},
  {id:'cold',label:'Cold work · 0°C or above'},
  {id:'freezer',label:'Cold work · below 0°C'},
  {id:'delivery',label:'Own vehicle · deliveries'},
  {id:'other-vehicle',label:'Own vehicle · other duties'},
  {id:'travel',label:'Extra travelling time'},
  {id:'meal',label:'Overtime meals'},
  {id:'reimbursement',label:'Work expense reimbursements'}
 ];
 function validate(value){
  if(!Array.isArray(value)||value.length>choices.length||value.some(id=>!choices.some(c=>c.id===id))||new Set(value).size!==value.length)throw Object.assign(Error('Choose valid staff allowances without duplicates.'),{status:400});
  return choices.filter(c=>value.includes(c.id)).map(c=>c.id);
 }
 function selected(profile){const ids=new Set(Array.isArray(profile?.allowanceSelections)?profile.allowanceSelections:[]);if(profile?.laundersUniform===true)ids.add('laundry');else ids.delete('laundry');return choices.filter(c=>ids.has(c.id));}
 return{choices,validate,selected};
});
