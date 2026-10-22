(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./learning-question-model'):root.learningQuestionModel,typeof module==='object'&&module.exports?require('./formatted-text'):root.formattedText);if(typeof module==='object'&&module.exports)module.exports=api;else root.aiQuestionTools=api;})(globalThis,(model,formatted)=>{
 const kinds=model.kinds;
 function contentText(value){if(value.richText?.blocks)return formatted.plainText({blocks:value.richText.blocks.filter(block=>!['image','video','audio','gallery','file','embed'].includes(block.type))}).trim();return(value.body||'').trim();}
 function answers(question){
  if(['single','multiple','boolean','dropdown'].includes(question.type))return(question.options||['True','False']).map((text,i)=>({text,correct:Array.isArray(question.correct)?question.correct.includes(i):question.correct===i}));
  if(question.type==='text')return[{text:'Accepted answers: '+question.accepted.join(' / '),correct:true}];
  if(question.type==='blanks')return question.blanks.map((blank,i)=>({text:'Blank '+(i+1)+': '+blank.answers.join(' / '),correct:true}));
  if(question.type==='number')return[{text:'Answer: '+question.expected+(question.unit?' '+question.unit:'')+' · tolerance '+question.tolerance,correct:true}];
  if(question.type==='matching')return question.pairs.map(pair=>({text:pair.left+' → '+pair.right,correct:true}));
  return question.items.map((text,i)=>({text:(i+1)+'. '+text,correct:true}));
 }
 function preview(host,question){const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;},card=el('article','');card.className='ai-question-preview';card.dataset.questionType=question.type;card.append(el('small',kinds[question.type]),el('strong',question.prompt));const list=el('ul','');for(const answer of answers(question))list.append(el('li',answer.text+(answer.correct?' ✓':'')));card.append(list);if(question.caseSensitive)card.append(el('small','Answers are case sensitive.'));host.append(card);}
 return{kinds,contentText,answers,preview};
});
