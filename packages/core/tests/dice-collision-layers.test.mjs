import test from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {DIE_COLLISION_LAYER,SCREEN_BOUNDARY_LAYER,DIE_COLLISION_MASK}
  from '../../../apps/web/src/lib/Dice3D.ts';

const die=(x,y,z,vx=0)=>{
  const b=new CANNON.Body({mass:1,
    collisionFilterGroup:DIE_COLLISION_LAYER,
    collisionFilterMask:DIE_COLLISION_MASK,
    shape:new CANNON.Sphere(5)});
  b.position.set(x,y,z);b.velocity.set(vx,0,0);
  return b;
};
const boundary=(shape,x=0,y=0,z=0)=>{
  const b=new CANNON.Body({mass:0,shape,
    collisionFilterGroup:SCREEN_BOUNDARY_LAYER,
    collisionFilterMask:DIE_COLLISION_LAYER});
  b.position.set(x,y,z);return b;
};
test('the real die collision mask includes other dice and screen boundaries',()=>{
  assert.equal(DIE_COLLISION_MASK,DIE_COLLISION_LAYER|SCREEN_BOUNDARY_LAYER);
  assert.ok((die(0,0,40).collisionFilterMask&DIE_COLLISION_LAYER)!==0);
});
test('two dice physically repel and exchange momentum rather than passing through',()=>{
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});
  world.defaultContactMaterial.restitution=.55;
  const a=die(0,0,40,60),b=die(40,0,40,-60);
  world.addBody(a);world.addBody(b);
  for(let i=0;i<50;i++)world.step(1/120);
  assert.ok(a.position.x<b.position.x,'dice must not tunnel through one another');
  assert.ok(a.velocity.x<0&&b.velocity.x>0,'collision must reverse their head-on velocities');
});
test('a newly thrown die cannot ghost through a previously settled die',()=>{
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});
  world.defaultContactMaterial.restitution=.45;
  const settled=new CANNON.Body({mass:0,
    collisionFilterGroup:DIE_COLLISION_LAYER,
    collisionFilterMask:DIE_COLLISION_LAYER,
    shape:new CANNON.Sphere(5)});
  settled.position.set(35,0,40);
  const incoming=die(0,0,40,100);
  world.addBody(settled);world.addBody(incoming);
  for(let i=0;i<100;i++)world.step(1/120);
  assert.ok(incoming.position.x<settled.position.x,
    'an incoming die stays on the approach side of the settled die');
  assert.ok(incoming.velocity.x<=0,
    'the incoming die must stop or rebound on contact');
});
test('a screen wall still physically blocks and reflects thrown dice',()=>{
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});
  const wall=boundary(new CANNON.Box(new CANNON.Vec3(1,100,100)),40,0,40);
  const a=die(0,0,40,130);
  world.addBody(wall);world.addBody(a);
  for(let i=0;i<90;i++)world.step(1/120);
  assert.ok(a.position.x<=35.5,'die cannot pass screen wall');
  assert.ok(a.velocity.x<0,'wall must reverse outward velocity');
});
test('supporting floor remains solid so dice settle and display a rolled face',()=>{
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,-98)});
  const floor=boundary(new CANNON.Plane());
  const a=die(0,0,35);
  world.addBody(floor);world.addBody(a);
  for(let i=0;i<300;i++)world.step(1/120);
  assert.ok(a.position.z>=4.7,'die must not fall through floor');
  assert.ok(a.position.z<=6,'die must land on supporting floor');
});
