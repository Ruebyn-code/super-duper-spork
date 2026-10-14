(function(root){
 // Names may come from uploaded catalogues. Keep spreadsheet formulas as text.
 function cell(value){let text=value===null||value===undefined?'':String(value);if(/^[\s]*[=+\-@]|^[\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
 function csv(rows){return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
 const api={csv};if(typeof module==='object'&&module.exports)module.exports=api;else root.reportingExport=api;
})(globalThis);
