const questions=[
 {type:'single',prompt:'Who should receive reports of opening issues?',options:['The manager','Nobody'],correct:0},
 {type:'multiple',prompt:'Which actions are in the opening procedure?',options:['Check the entrance','Report issues','Ignore issues'],correct:[0,1]},
 {type:'boolean',prompt:'Opening issues should be reported to the manager.',correct:0},
 {type:'dropdown',prompt:'Choose who receives reports of issues.',options:['The manager','Nobody'],correct:0},
 {type:'text',prompt:'Who receives reports of opening issues?',accepted:['manager','the manager'],caseSensitive:false},
 {type:'blanks',prompt:'Report issues to the {1}.',blanks:[{answers:['manager']}],caseSensitive:false},
 {type:'number',prompt:'How many actions are described: check the entrance and report issues?',expected:2,tolerance:0,unit:'actions'},
 {type:'matching',prompt:'Match each responsibility with its action.',pairs:[{left:'Entrance',right:'Check'},{left:'Issues',right:'Report'}]},
 {type:'ordering',prompt:'Put the opening actions in the described order.',items:['Check the entrance','Report issues to the manager']}
];
const source={type:'content',items:[{title:'Opening procedure',text:'First check the entrance, then report issues to the manager. These are the two opening actions.'}]};
function response(input){const chosen=questions.filter(question=>input.questionTypes.includes(question.type));return{title:'Opening knowledge check',questions:Array.from({length:input.questionCount},(_,i)=>structuredClone(chosen[i%chosen.length]))};}
function input(extra={}){return{kind:'questions',requestId:require('node:crypto').randomUUID(),prompt:'Check understanding of the selected source.',source:structuredClone(source),questionTypes:questions.map(q=>q.type),questionCount:9,...extra};}
module.exports={questions,source,response,input};
