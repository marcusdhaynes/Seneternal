import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideDrag,bookAgainstDie,dieAgainstBook,dieAgainstDie,overlapsDragObstacle}
  from '../../../apps/web/src/lib/dragCollision.ts';

const separated=(p,o)=>assert.ok(!overlapsDragObstacle(p,o),JSON.stringify({p,o}));
const near=(p,t,slack=1)=>assert.ok(Math.hypot(p.x-t.x,p.y-t.y)<slack,JSON.stringify({p,t}));

test('directly dragging through a book never teleports to the far side',()=>{
  const cover=dieAgainstBook({left:-30,right:30,top:-45,bottom:45},12);
  const end=slideDrag({x:-100,y:0},{x:100,y:0},[cover]);
  separated(end,cover);assert.ok(end.x<0,end.x);
});
test('book is freely movable around dice with natural three-part cursor motion',()=>{
  const die=bookAgainstDie({x:0,y:0},14,32,44);
  let p={x:-100,y:0};
  for(const t of [{x:-100,y:-95},{x:100,y:-95},{x:100,y:0}]){
    p=slideDrag(p,t,[die]);separated(p,die);
  }
  near(p,{x:100,y:0});
});
test('dragging a die diagonally against a book continues along its edge',()=>{
  const cover=dieAgainstBook({left:-30,right:30,top:-45,bottom:45},12);
  const p=slideDrag({x:-42.3,y:-12},{x:0,y:-35},[cover]);
  separated(p,cover);
  assert.ok(p.y<-12,'Allowed tangential motion should not freeze');
});
test('a die naturally follows a path around a hardcover',()=>{
  const cover=dieAgainstBook({left:-35,right:35,top:-50,bottom:50},12);
  let p={x:-100,y:0};
  for(const t of [{x:-100,y:-100},{x:100,y:-100},{x:100,y:0}]){
    p=slideDrag(p,t,[cover]);separated(p,cover);
  }
  near(p,{x:100,y:0});
});
test('coin-on-coin collision stays stable under jittering pointer input',()=>{
  const other=dieAgainstDie({x:0,y:0},24);
  let p={x:-40,y:0};
  for(let i=0;i<60;i++){
    const t={x:35+(i%2===0?.25:-.25),y:0};
    const next=slideDrag(p,t,[other]);
    separated(next,other);
    assert.ok(Math.hypot(next.x-p.x,next.y-p.y)<25,'No sudden jumps');
    p=next;
  }
  assert.ok(p.x<0,'Do not teleport behind the other coin');
});
test('several coins are solid but the book can be guided around the pile',()=>{
  const coins=[-28,0,28].map(x=>bookAgainstDie({x,y:0},14,22,30));
  let p={x:-110,y:0};
  for(const t of [{x:-110,y:-90},{x:110,y:-90},{x:110,y:0}]){
    p=slideDrag(p,t,coins);
    coins.forEach(o=>separated(p,o));
  }
  near(p,{x:110,y:0});
});
test('no obstacles preserves subpixel pointer position',()=>{
  const target={x:71.7,y:12.3};
  assert.deepEqual(slideDrag({x:0,y:0},target,[]),target);
});
test('invalid collider cannot produce NaN drag coordinates',()=>{
  const target={x:22,y:91};
  assert.deepEqual(slideDrag({x:0,y:0},target,
    [{left:0,right:NaN,top:0,bottom:1,radius:8}]),target);
});
