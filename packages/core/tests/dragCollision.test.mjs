import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideDrag,bookAgainstDie,dieAgainstBook,dieAgainstDie}
  from '../../../apps/web/src/lib/dragCollision.ts';

const separated=(p,o)=>{
  const x=Math.max(o.left,Math.min(p.x,o.right));
  const y=Math.max(o.top,Math.min(p.y,o.bottom));
  return Math.hypot(p.x-x,p.y-y)>=o.radius-1e-3;
};
const near=(a,b,slack=2)=>Math.hypot(a.x-b.x,a.y-b.y)<=slack;

test('book bypasses a die instead of freezing at first contact',()=>{
  const die=bookAgainstDie({x:0,y:0},14,32,44);
  const end=slideDrag({x:-110,y:0},{x:110,y:0},[die]);
  assert.ok(near(end,{x:110,y:0}),JSON.stringify(end));
  assert.ok(separated(end,die));
});
test('a selected die follows a route around a solid hardcover',()=>{
  const cover=dieAgainstBook({left:-35,top:-50,right:35,bottom:50},12);
  for(const [start,finish] of [
    [{x:-110,y:0},{x:105,y:0}],
    [{x:-110,y:-45},{x:100,y:45}],
    [{x:-80,y:-75},{x:85,y:90}]
  ]){
    const end=slideDrag(start,finish,[cover]);
    assert.ok(near(end,finish),JSON.stringify({start,finish,end}));
    assert.ok(separated(end,cover));
  }
});
test('crowded dice are routed around as a pile rather than trapping the book',()=>{
  const dice=[-50,-20,10,40].map(x=>dieAgainstDie({x,y:0},17));
  const end=slideDrag({x:-130,y:0},{x:120,y:0},dice);
  assert.ok(near(end,{x:120,y:0}),JSON.stringify(end));
  assert.ok(dice.every(o=>separated(end,o)));
});
test('pointer positions inside a hardcover are projected to a legal edge',()=>{
  const cover=dieAgainstBook({left:-35,right:35,top:-50,bottom:50},12);
  const end=slideDrag({x:-100,y:0},{x:0,y:0},[cover]);
  assert.ok(separated(end,cover),JSON.stringify(end));
});
test('ordinary unblocked dragging preserves exact pointer coordinates',()=>{
  const target={x:108.125,y:-31.75};
  assert.deepEqual(slideDrag({x:-90,y:30},target,[]),target);
});
test('invalid rectangles are ignored without breaking pointer motion',()=>{
  const target={x:22,y:91};
  assert.deepEqual(slideDrag({x:0,y:0},target,[{
    left:0,right:NaN,top:0,bottom:1,radius:8
  }]),target);
});
