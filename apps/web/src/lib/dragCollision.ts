/** Swept kinematic dragging: solids never overlap, while a dragged object
 * slides and routes around contact edges instead of freezing on collision. */
export interface DragPoint {x:number;y:number}
export interface DragObstacle {left:number;top:number;right:number;bottom:number;radius:number}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const distance=(a:DragPoint,b:DragPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(o:DragObstacle)=>[o.left,o.right,o.top,o.bottom,o.radius].every(Number.isFinite)&&
  o.left<=o.right&&o.top<=o.bottom&&o.radius>=0;
interface Contact {nx:number;ny:number;depth:number;obstacle:DragObstacle}
function overlap(p:DragPoint,o:DragObstacle):Contact|null{
  const nx=p.x-clamp(p.x,o.left,o.right),ny=p.y-clamp(p.y,o.top,o.bottom);
  const mag=Math.hypot(nx,ny),clearance=o.radius+.075;
  if(mag>=clearance)return null;
  if(mag>1e-7)return {nx:nx/mag,ny:ny/mag,depth:clearance-mag,obstacle:o};
  const sides=[p.x-o.left,o.right-p.x,p.y-o.top,o.bottom-p.y];
  const at=sides.indexOf(Math.min(...sides));
  return {nx:at===0?-1:at===1?1:0,ny:at===2?-1:at===3?1:0,
    depth:Math.max(0,sides[at])+clearance,obstacle:o};
}
function project(point:DragPoint,obstacles:DragObstacle[]):DragPoint{
  const p={...point};
  for(let iteration=0;iteration<obstacles.length*3+1;iteration++){
    let deepest:Contact|null=null;
    for(const obstacle of obstacles){
      const contact=overlap(p,obstacle);
      if(contact&&(!deepest||contact.depth>deepest.depth))deepest=contact;
    }
    if(!deepest)break;
    p.x+=deepest.nx*deepest.depth;p.y+=deepest.ny*deepest.depth;
  }
  return p;
}
function tangentForContact(p:DragPoint,target:DragPoint,contact:Contact):DragPoint{
  const {nx,ny,obstacle:o}=contact,t={x:-ny,y:nx};
  const toward={x:target.x-p.x,y:target.y-p.y};
  const projection=t.x*toward.x+t.y*toward.y;
  if(Math.abs(projection)>1.5)return projection>0?t:{x:-t.x,y:-t.y};
  const center={x:(o.left+o.right)/2,y:(o.top+o.bottom)/2};
  const escape={x:Math.abs(target.x-center.x)>1?target.x-center.x:p.x-center.x,
    y:Math.abs(target.y-center.y)>1?target.y-center.y:p.y-center.y};
  const bias=t.x*escape.x+t.y*escape.y;
  if(Math.abs(bias)>1e-5)return bias>0?t:{x:-t.x,y:-t.y};
  return ny<0||nx>0?t:{x:-t.x,y:-t.y};
}
/** Conservative route visibility test on the collider's expanded bounds. */
function segmentHits(p:DragPoint,target:DragPoint,o:DragObstacle):boolean{
  const r=o.radius+.1,box={left:o.left-r,right:o.right+r,
    top:o.top-r,bottom:o.bottom+r};
  const dx=target.x-p.x,dy=target.y-p.y;
  let min=0,max=1;
  for(const [pos,delta,low,high] of [[p.x,dx,box.left,box.right],
    [p.y,dy,box.top,box.bottom]]){
    if(Math.abs(delta)<1e-8){if(pos<low||pos>high)return false;continue;}
    const t0=(low-pos)/delta,t1=(high-pos)/delta;
    min=Math.max(min,Math.min(t0,t1));max=Math.min(max,Math.max(t0,t1));
    if(min>max)return false;
  }
  return max>.001&&min<1;
}
function normalAt(p:DragPoint,o:DragObstacle):DragPoint{
  const dx=p.x-clamp(p.x,o.left,o.right),dy=p.y-clamp(p.y,o.top,o.bottom);
  const len=Math.hypot(dx,dy);
  if(len>1e-8)return {x:dx/len,y:dy/len};
  const sides=[p.x-o.left,o.right-p.x,p.y-o.top,o.bottom-p.y];
  const at=sides.indexOf(Math.min(...sides));
  return {x:at===0?-1:at===1?1:0,y:at===2?-1:at===3?1:0};
}
/** Shortest safe corner detour for crowded piles where local sliding alone
 * can get trapped between overlapping object footprints. */
function routeAround(start:DragPoint,goal:DragPoint,all:DragObstacle[]):DragPoint[]|null{
  const relevant=all.filter(o=>{
    const cx=(o.left+o.right)/2,cy=(o.top+o.bottom)/2;
    const vx=goal.x-start.x,vy=goal.y-start.y,lenSq=vx*vx+vy*vy;
    const projection=lenSq>0?clamp(((cx-start.x)*vx+(cy-start.y)*vy)/lenSq,0,1):0;
    const closest={x:start.x+vx*projection,y:start.y+vy*projection};
    const span=Math.hypot(o.right-o.left,o.bottom-o.top)*.5+o.radius+60;
    return distance(closest,{x:cx,y:cy})<span;
  }).slice(0,22);
  if(!relevant.length)return null;
  const nodes=[start,goal];
  for(const o of relevant){
    const edge=o.radius+1.5;
    for(const x of [o.left-edge,o.right+edge])for(const y of [o.top-edge,o.bottom+edge]){
      const point={x,y};
      if(!all.some(other=>overlap(point,other)))nodes.push(point);
    }
  }
  const reachable=(a:DragPoint,b:DragPoint)=>!all.some(o=>segmentHits(a,b,o));
  const dist=Array(nodes.length).fill(Infinity) as number[],
    from=Array(nodes.length).fill(-1) as number[],used=new Set<number>();
  dist[0]=0;
  for(let k=0;k<nodes.length;k++){
    let chosen=-1,best=Infinity;
    for(let i=0;i<nodes.length;i++)if(!used.has(i)&&dist[i]<best){best=dist[i];chosen=i;}
    if(chosen<0||chosen===1)break;
    used.add(chosen);
    for(let j=0;j<nodes.length;j++){
      if(used.has(j)||j===chosen||!reachable(nodes[chosen],nodes[j]))continue;
      const candidate=best+distance(nodes[chosen],nodes[j]);
      if(candidate<dist[j]){dist[j]=candidate;from[j]=chosen;}
    }
  }
  if(!Number.isFinite(dist[1]))return null;
  const route:DragPoint[]=[];
  for(let at=1;at!==0&&at>=0;at=from[at])route.unshift(nodes[at]);
  return route.length?route:null;
}
/** Collision-safe pointer following with automatic tangent steering.
 * A fast pointer movement is integrated in small steps to prevent tunneling. */
export function slideDrag(start:DragPoint,target:DragPoint,raw:readonly DragObstacle[],
  maxTravel=1800):DragPoint{
  if(![start.x,start.y,target.x,target.y].every(Number.isFinite))return {...start};
  const obstacles=raw.filter(valid);
  if(!obstacles.length)return {...target};
  let p=project(start,obstacles);
  const goal=project(target,obstacles);
  const step=3.5,limit=Math.min(900,Math.ceil(maxTravel/step));
  let bypass:{obstacle:DragObstacle;sign:1|-1}|null=null;
  let noProgress=0;
  for(let i=0;i<limit;i++){
    const remaining=distance(p,goal);
    if(remaining<=.55)break;
    const vx=(goal.x-p.x)/remaining,vy=(goal.y-p.y)/remaining;
    const amount=Math.min(step,remaining);
    let next={x:p.x+vx*amount,y:p.y+vy*amount};
    let contact:Contact|null=null;
    for(const ob of obstacles){
      const hit=overlap(next,ob);
      if(hit&&(!contact||hit.depth>contact.depth))contact=hit;
    }
    if(bypass&&!segmentHits(p,goal,bypass.obstacle))bypass=null;
    if(contact&&!bypass){
      const tangential=tangentForContact(p,goal,contact);
      const normal=normalAt(p,contact.obstacle),positive={x:-normal.y,y:normal.x};
      bypass={obstacle:contact.obstacle,sign:
        positive.x*tangential.x+positive.y*tangential.y>=0?1:-1};
    }
    if(bypass){
      const n=normalAt(p,bypass.obstacle);
      const steer={x:-n.y*bypass.sign,y:n.x*bypass.sign};
      next={x:p.x+steer.x*amount+n.x*.04,
        y:p.y+steer.y*amount+n.y*.04};
    }
    next=project(next,obstacles);
    const moved=distance(next,p);
    if(moved<.015){noProgress++;if(noProgress>12)break;}
    else noProgress=0;
    p=next;
  }
  if(distance(p,goal)>4){
    const route=routeAround(start,goal,obstacles);
    if(route){
      let remainingTravel=maxTravel;
      p=project(start,obstacles);
      for(const waypoint of route){
        const length=distance(p,waypoint);
        if(length>remainingTravel){
          p={x:p.x+(waypoint.x-p.x)*remainingTravel/length,
            y:p.y+(waypoint.y-p.y)*remainingTravel/length};
          break;
        }
        p=waypoint;remainingTravel-=length;
      }
      p=project(p,obstacles);
    }
  }
  return p;
}
/** Minkowski shapes: book vs circle, die vs book, and die vs die. */
export const bookAgainstDie=(die:DragPoint,radius:number,halfWidth:number,halfHeight:number):DragObstacle=>({
  left:die.x-halfWidth,right:die.x+halfWidth,top:die.y-halfHeight,
  bottom:die.y+halfHeight,radius
});
export const dieAgainstBook=(book:{left:number;right:number;top:number;bottom:number},radius:number):DragObstacle=>({
  ...book,radius
});
export const dieAgainstDie=(die:DragPoint,radius:number):DragObstacle=>({
  left:die.x,right:die.x,top:die.y,bottom:die.y,radius
});
