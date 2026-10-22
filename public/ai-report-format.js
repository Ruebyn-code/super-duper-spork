(function(root){
 function fact(value){if(value.value===null||value.value===undefined)return'Not available';if(value.unit==='AUD cents')return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value.value/100);if(value.unit==='percent')return new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(value.value)+'%';return typeof value.value==='number'?new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(value.value):String(value.value);}
 const api={fact};if(typeof module==='object'&&module.exports)module.exports=api;else root.aiReportFormat=api;
})(globalThis);
