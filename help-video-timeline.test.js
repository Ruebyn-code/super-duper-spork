const {test}=require('node:test'),assert=require('node:assert/strict');
const {timeline,captions}=require('./tools/help-video-timeline.cjs');

test('video timing leaves reading time intact, including long instructions, and chapter links land on a clear frame',()=>{
 const steps=['Open Ordering.','Read '+Array(100).fill('example').join(' ')+'.','Review and save.'],timing=timeline(steps);
 assert.equal(timing.chapters[0].startSeconds,0);assert.equal(timing.chapters[0].seekSeconds,0);
 assert(timing.chapters[1].endSeconds-timing.chapters[1].startSeconds>30,'Long instructions are not cut off at an arbitrary short maximum');
 for(let i=0;i<steps.length;i++){
  const c=timing.chapters[i];assert(c.endSeconds-c.startSeconds>=6);assert.equal(c.startSeconds,i?timing.chapters[i-1].endSeconds:0);
  for(const value of Object.values(c))assert(Math.abs(value*24-Math.round(value*24))<1e-8,'All timing lands on a video frame');
  if(i)assert(c.seekSeconds>=c.startSeconds+.25&&c.seekSeconds<c.endSeconds);
 }
 assert.equal(timing.durationSeconds,timing.chapters.at(-1).endSeconds);assert.throws(()=>timeline([]),/at least one/);
 const single=timeline(['Read the result.']);assert.equal(single.durationSeconds,6);assert.deepEqual(single.chapters,[{startSeconds:0,endSeconds:6,seekSeconds:0}]);
});

test('video captions cover the whole timeline without gaps and preserve instruction text safely',()=>{
 const steps=['Choose A & B.','Enter <example> in the field.'],timing=timeline(steps),vtt=captions(steps,timing.chapters);
 assert.equal(vtt,'WEBVTT\n\n1\n00:00:00.000 --> 00:00:06.000\nStep 1: Choose A &amp; B.\n\n2\n00:00:06.000 --> 00:00:12.000\nStep 2: Enter &lt;example&gt; in the field.\n');
});
