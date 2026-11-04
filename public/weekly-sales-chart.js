// Read-only weekly sales bar chart for Sales → Weekly overview. It only draws the rows the overview already loaded.
(()=>{
 const NS='http://www.w3.org/2000/svg',height=200,pad={top:14,right:12,bottom:38,left:52};
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
 const axisMoney=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',notation:'compact',maximumFractionDigits:1}).format(cents/100);
 const shortDate=value=>value.slice(8)+'/'+value.slice(5,7),longDate=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const svg=(tag,attrs={})=>{const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);return node;};
 function niceStep(max){const raw=max/4,power=10**Math.floor(Math.log10(raw||1)),scaled=raw/power;return (scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10)*power;}
 window.createWeeklySalesChart=host=>{
  if(!host)return{render(){}};
  const title=document.createElement('figcaption'),plot=document.createElement('div'),key=document.createElement('div'),tip=document.createElement('div');
  title.className='overview-chart-title';plot.className='overview-chart-plot';key.className='overview-chart-key';tip.className='overview-chart-tip';tip.hidden=true;tip.setAttribute('role','status');
  host.append(title,plot,key,tip);let state=null,frame=0;
  const hide=()=>{tip.hidden=true;};
  function show(target,lines){tip.replaceChildren(...lines.map((text,index)=>{const line=document.createElement(index?'span':'strong');line.textContent=text;line.dataset.userText='';return line;}));tip.hidden=false;const box=host.getBoundingClientRect(),mark=target.getBoundingClientRect(),width=tip.offsetWidth;tip.style.left=Math.max(4,Math.min(box.width-width-4,mark.left-box.left+mark.width/2-width/2))+'px';tip.style.top=Math.max(0,mark.top-box.top-tip.offsetHeight-8)+'px';}
  function draw(){
   if(!state)return;const {rows,average,ytd}=state,width=Math.max(280,plot.clientWidth||host.clientWidth||600),innerW=width-pad.left-pad.right,innerH=height-pad.top-pad.bottom;
   const values=rows.map(row=>Number.isSafeInteger(row.salesCents)?row.salesCents:null),averageCents=Number.isSafeInteger(average?.salesCents)?average.salesCents:null;
   const top=Math.max(1,...values.filter(value=>value!==null),averageCents??0),step=niceStep(top),max=Math.ceil(top/step)*step,y=value=>pad.top+innerH-value/max*innerH;
   const chart=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':wording('Weekly sales chart. The table below lists every week.')});
   const defs=svg('defs'),pattern=svg('pattern',{id:'overview-partial-hatch',width:6,height:6,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});pattern.append(svg('rect',{width:6,height:6,class:'overview-chart-partial-fill'}),svg('line',{x1:0,y1:0,x2:0,y2:6,class:'overview-chart-partial-line'}));const gradient=svg('linearGradient',{id:'overview-bar-gradient',x1:0,y1:1,x2:0,y2:0});gradient.append(svg('stop',{offset:'0%',class:'overview-chart-stop-start'}),svg('stop',{offset:'100%',class:'overview-chart-stop-end'}));defs.append(pattern,gradient);chart.append(defs);
   for(let tick=0;tick<=max;tick+=step){const line=svg('line',{x1:pad.left,x2:width-pad.right,y1:y(tick),y2:y(tick),class:tick?'overview-chart-grid':'overview-chart-baseline'}),label=svg('text',{x:pad.left-6,y:y(tick)+3.5,'text-anchor':'end',class:'overview-chart-axis'});label.textContent=axisMoney(tick);chart.append(line,label);}
   const slot=innerW/Math.max(1,rows.length),barW=Math.max(3,Math.min(34,slot-2)),labelEvery=Math.max(1,Math.ceil(40/slot));
   rows.forEach((row,index)=>{
    const x=pad.left+slot*index+(slot-barW)/2,value=values[index],partial=row.recordedDays>0&&row.recordedDays<7,link=svg('a',{href:'/sales?week='+encodeURIComponent(row.weekStart)+'#report',class:'overview-chart-bar'+(partial?' partial':'')+(value===null?' missing':'')});
    const week=window.salesWeek?.info(row.weekStart),weekNumber=week?(ytd?week.yearWeek:week.quarterWeek):null;const lines=[...(week?[wording('Week {quarterWeek} of Q{quarter} · Week {yearWeek} of {year}',week)]:[]),longDate(row.weekStart)+' – '+longDate(row.weekEnd),value===null?wording('No sales recorded'):money(value)];if(partial)lines.push(wording('{count}/7 days recorded',{count:row.recordedDays}));
    link.setAttribute('aria-label',lines.join(', '));link.append(svg('rect',{x:pad.left+slot*index,y:pad.top,width:slot,height:innerH,class:'overview-chart-hit'}));
    if(value!==null&&value>0){const h=Math.max(1,y(0)-y(value)),r=Math.min(4,barW/2,h);link.append(svg('path',{d:`M${x},${y(0)} V${y(0)-h+r} Q${x},${y(0)-h} ${x+r},${y(0)-h} H${x+barW-r} Q${x+barW},${y(0)-h} ${x+barW},${y(0)-h+r} V${y(0)} Z`,class:'overview-chart-mark'}));}
    else link.append(svg('line',{x1:x,x2:x+barW,y1:y(0)-1,y2:y(0)-1,class:'overview-chart-empty'}));
    link.addEventListener('pointerenter',()=>show(link,lines));link.addEventListener('focus',()=>show(link,lines));link.addEventListener('pointerleave',hide);link.addEventListener('blur',hide);chart.append(link);
    if(index%labelEvery===0){const label=svg('text',{x:pad.left+slot*index+slot/2,y:height-8,'text-anchor':'middle',class:'overview-chart-axis'});label.textContent=shortDate(row.weekStart);chart.append(label);if(weekNumber!==null){const number=svg('text',{x:pad.left+slot*index+slot/2,y:height-21,'text-anchor':'middle',class:'overview-chart-week'});number.textContent='W'+weekNumber;chart.append(number);}}
   });
   if(averageCents!==null){const line=svg('line',{x1:pad.left,x2:width-pad.right,y1:y(averageCents),y2:y(averageCents),class:'overview-chart-average'});chart.append(line);}
   plot.replaceChildren(chart);
   const items=[];if(averageCents!==null)items.push(['average',wording('Average of completed weeks · {amount}',{amount:money(averageCents)})]);if(rows.some(row=>row.recordedDays>0&&row.recordedDays<7))items.push(['partial',wording('Part-recorded week')]);
   key.replaceChildren(...items.map(([kind,text])=>{const item=document.createElement('span'),swatch=document.createElement('span'),label=document.createElement('span');item.className='overview-chart-key-item';swatch.className='overview-chart-swatch '+kind;swatch.setAttribute('aria-hidden','true');label.textContent=text;label.dataset.userText='';item.append(swatch,label);return item;}));key.hidden=!items.length;
  }
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}).observe(host);
  return{render(rows,average,period){hide();const list=Array.isArray(rows)?rows:[];host.hidden=!list.some(row=>Number.isSafeInteger(row.salesCents));state=host.hidden?null:{rows:list,average,ytd:period?.mode==='ytd'};title.textContent=wording('Weekly sales');if(!host.hidden)draw();}};
 };
})();
