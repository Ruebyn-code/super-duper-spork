const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('./public/roster-drag-model');
test('roster edge scrolling ramps at each edge, stops outside reach and remains bounded in narrow or invalid viewports',()=>{
 assert.equal(D.edgeVelocity(150,0,300),0);assert.equal(D.edgeVelocity(0,0,300),-720);assert.equal(D.edgeVelocity(300,0,300),720);assert.equal(D.edgeVelocity(-60,0,300),0);assert.equal(D.edgeVelocity(360,0,300),0);assert(Math.abs(D.edgeVelocity(30,0,300))<Math.abs(D.edgeVelocity(10,0,300)));assert.equal(D.edgeVelocity(25,0,50),0);assert.equal(D.edgeVelocity(100,100,100),0);assert.equal(D.edgeVelocity(NaN,0,300),0);assert.equal(D.threshold('touch'),8);assert.equal(D.threshold('mouse'),5);assert.equal(D.threshold('pen'),5);
});
test('roster scrolling retains fractional pixels across refresh rates, reverses safely and bounds delayed frames',()=>{
 function simulate(rate,velocity){let remainder=0,total=0;for(let n=0;n<rate;n++){const step=D.scrollStep(remainder,velocity,1000/rate);remainder=step.remainder;total+=step.delta;}return{total,remainder};}
 for(const velocity of [-720,-87,87,720]){const low=simulate(60,velocity),high=simulate(120,velocity);assert(Math.abs(low.total-high.total)<=1);assert(Math.abs(low.total+low.remainder-velocity)<1e-8);assert(Math.abs(high.total+high.remainder-velocity)<1e-8);}
 assert.deepEqual(D.scrollStep(.75,-100,10),{delta:0,remainder:-.25});assert.equal(D.scrollStep(0,1000,10000).delta,32);assert.deepEqual(D.scrollStep(0,1000,-1),{delta:0,remainder:0});assert.deepEqual(D.scrollStep(NaN,1,16),{delta:0,remainder:0});
});
