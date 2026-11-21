/** Deterministic swept tabletop dragging. No path planning or corner
 * teleporting: blocked inward motion is discarded while free tangential
 * pointer motion continues, exactly like sliding a coin along a book edge. */
export interface DragPoint {x:number;y:number}
export interface DragObstacle {left:number;top:number;right:number;bottom:number;radius:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(n:number)=>Number.isFinite(n);
const valid=(o:DragObstacle)=>[o.left,o.right,o.top,o.bottom,o.radius].every(finite)&&
  o.left<=o.right&&o.top<=o.bottom&&o.radius>=0;
const EPSILON=.2;
/** Rounded-rectangle/disc contact; zero-size rectangles represent dice or coins. */
export function overlapsDragObstacle(p:DragPoint,o:DragObstacle):boolean{
  const nearX=clamp(p.x,o.left,o.right),nearY=clamp(p.y,o.top,o.bottom);
  const dx=p.x-nearX,dy=p.y-nearY;
  return dx*dx+dy*dy<(o.radius+EPSILON)**2-1e-7;
}
const free=(p:DragPoint,obstacles:readonly DragObstacle[])=>
  !obstacles.some(o=>overlapsDragObstacle(p,o));
/** Old overlapping saved positions are separated once, by the minimum
 * correction. A drag never repeatedly replans or snaps to distant corners. */
function depenetrate(start:DragPoint,obstacles:readonly DragObstacle[]):DragPoint{
  let p={...start};
  for(let attempt=0;attempt<obstacles.length*2+2;attempt++){
    const o=obstacles.find(ob=>overlapsDragObstacle(p,ob));
    if(!o)break;
    const x=clamp(p.x,o.left,o.right),y=clamp(p.y,o.top,o.bottom);
    const dx=p.x-x,dy=p.y-y,len=Math.hypot(dx,dy);
    if(len>1e-6){
      const push=o.radius+EPSILON+.005-len;
      p={x:p.x+dx/len*push,y:p.y+dy/len*push};
    }else{
      const edges=[
        {x:o.left-o.radius-EPSILON-.005,y:p.y},
        {x:o.right+o.radius+EPSILON+.005,y:p.y},
        {x:p.x,y:o.top-o.radius-EPSILON-.005},
        {x:p.x,y:o.bottom+o.radius+EPSILON+.005}];
      // Stable order breaks ties consistently instead of oscillating.
      edges.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
      p=edges[0];
    }
  }
  return p;
}
/** Continuous collision checking on each short pointer step. No A* detours,
 * no implicit momentum, and no sudden travel to the far side of an obstacle.
 * Users guide objects around solid items by actually dragging around them. */
export function slideDrag(start:DragPoint,target:DragPoint,raw:readonly DragObstacle[],
  maxTravel=1800):DragPoint{
  if(![start.x,start.y,target.x,target.y].every(finite))return {...start};
  const obstacles=raw.filter(valid);
  if(!obstacles.length)return {...target};
  let p=depenetrate(start,obstacles);
  const dx=target.x-p.x,dy=target.y-p.y,dist=Math.hypot(dx,dy);
  if(dist<.00001)return p;
  const distance=Math.min(dist,Math.max(0,maxTravel));
  if(distance<.00001)return p;
  const goal={x:p.x+dx*distance/dist,y:p.y+dy*distance/dist};
  const steps=Math.max(1,Math.ceil(distance/2.5));
  const increment={x:(goal.x-p.x)/steps,y:(goal.y-p.y)/steps};
  for(let i=0;i<steps;i++){
    const whole={x:p.x+increment.x,y:p.y+increment.y};
    if(free(whole,obstacles)){p=whole;continue;}
    // Advance only the component that does not penetrate a solid.
    // An almost-horizontal move into a wall STAYS against that wall; a
    // diagonal move slides along it without forcing an arbitrary route.
    const xFirst=Math.abs(increment.x)>=Math.abs(increment.y);
    const first=xFirst?{x:p.x+increment.x,y:p.y}:{x:p.x,y:p.y+increment.y};
    if(free(first,obstacles))p=first;
    const second=xFirst?{x:p.x,y:p.y+increment.y}:{x:p.x+increment.x,y:p.y};
    if(free(second,obstacles))p=second;
  }
  return p;
}
export const bookAgainstDie=(die:DragPoint,radius:number,halfWidth:number,halfHeight:number):DragObstacle=>({
  left:die.x-halfWidth,right:die.x+halfWidth,
  top:die.y-halfHeight,bottom:die.y+halfHeight,radius
});
export const dieAgainstBook=(book:{left:number;right:number;top:number;bottom:number},radius:number):DragObstacle=>({
  ...book,radius
});
export const dieAgainstDie=(die:DragPoint,radius:number):DragObstacle=>({
  left:die.x,right:die.x,top:die.y,bottom:die.y,radius
});
