/** Actual rigid-body coin toss: a Cannon-es cylinder drives a textured
 * Three.js metal coin. The WebGL scene exists only for the airborne throw. */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type {CoinAppearance} from '../components/CoinArt';

export interface CoinTossObstacles {
  books:readonly {left:number;top:number;right:number;bottom:number}[];
  solids:readonly {x:number;y:number;radius:number;kind:'die'|'coin'}[];
}
export interface CoinTossResult {x:number;y:number;heads:boolean;rotation:number}
export interface CoinTossOptions extends CoinTossObstacles {
  host:HTMLElement;width:number;height:number;
  x:number;y:number;deltaX:number;deltaY:number;durationMs:number;
  radius:number;value:number|string;color:string;appearance:CoinAppearance;
  onLand:(result:CoinTossResult)=>void;onError?:(error:unknown)=>void;
}
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
function shades(color:string){
  const base=/^#[0-9a-fA-F]{6}$/.test(color)?new THREE.Color(color):new THREE.Color('#d8b979');
  return {base,light:base.clone().lerp(new THREE.Color('#ffffff'),.56),
    dark:base.clone().multiplyScalar(.31)};
}
function faceTexture(value:string,color:string,heads:boolean,appearance:CoinAppearance){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1536;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Coin texture canvas unavailable');
  ctx.scale(3,3);
  const {base,light,dark}=shades(color);
  const hex=(c:THREE.Color)=>'#'+c.getHexString();
  const gradient=ctx.createRadialGradient(180,150,28,255,255,255);
  gradient.addColorStop(0,hex(light));gradient.addColorStop(.66,hex(base));
  gradient.addColorStop(1,hex(dark));
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(256,256,254,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=hex(dark);ctx.lineWidth=19;
  ctx.beginPath();ctx.arc(256,256,239,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=hex(light);ctx.lineWidth=6;
  for(const radius of [222,196,176]){
    ctx.beginPath();ctx.arc(256,256,radius,0,Math.PI*2);ctx.stroke();
  }
  for(let i=0;i<48;i++){
    const a=i*Math.PI/24,x=Math.cos(a),y=Math.sin(a);
    ctx.beginPath();ctx.moveTo(256+x*206,256+y*206);
    ctx.lineTo(256+x*216,256+y*216);
    ctx.lineWidth=3;ctx.strokeStyle=hex(dark);ctx.stroke();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=hex(dark);
  ctx.font=heads?'900 130px Georgia, serif':'bold 55px Georgia, serif';
  ctx.shadowColor='rgba(255,255,255,.52)';ctx.shadowBlur=2;
  ctx.shadowOffsetY=3;
  ctx.fillText(heads?value:'SENETERNAL',256,260,310);
  ctx.shadowBlur=0;
  if(!heads){
    ctx.font='bold 96px Georgia, serif';ctx.fillText('✦',256,190);
    ctx.font='bold 30px Georgia, serif';ctx.fillText('TABLETOP COIN',256,330,260);
  }else{
    ctx.font='bold 27px Georgia, serif';ctx.fillText('SENETERNAL',256,357,260);
  }
  if(appearance.finish==='brushed'){
    ctx.globalAlpha=.065;ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
    for(let i=0;i<150;i++){
      const y=45+i*3;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(472,y);ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.generateMipmaps=true;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=16;
  return texture;
}
type Resources={geometries:THREE.BufferGeometry[];materials:THREE.Material[];textures:THREE.Texture[]};
function coinMesh(radius:number,thickness:number,opt:CoinTossOptions,resources:Resources){
  const color=shades(opt.color),finish=opt.appearance.finish;
  const metalness=finish==='enamel'?.25:finish==='matte'?.32:.87;
  const roughness=finish==='matte'?.82:finish==='brushed'?.46:.23;
  const heads=faceTexture(String(opt.value),opt.color,true,opt.appearance),
    tails=faceTexture(String(opt.value),opt.color,false,opt.appearance);
  resources.textures.push(heads,tails);
  const edge=new THREE.MeshStandardMaterial({color:color.base,metalness:.86,roughness:.3,side:THREE.DoubleSide});
  const front=new THREE.MeshPhysicalMaterial({map:heads,metalness,roughness,clearcoat:.17,
    clearcoatRoughness:.22,side:THREE.DoubleSide});
  const back=new THREE.MeshPhysicalMaterial({map:tails,metalness,roughness,clearcoat:.17,
    clearcoatRoughness:.22,side:THREE.DoubleSide});
  resources.materials.push(edge,front,back);
  const root=new THREE.Group();
  const geo=new THREE.CylinderGeometry(radius,radius,thickness,72,1,false);
  resources.geometries.push(geo);
  const disk=new THREE.Mesh(geo,[edge,front,back]);
  disk.rotation.x=Math.PI/2;root.add(disk);
  const ring=new THREE.TorusGeometry(radius*.967,thickness*.095,5,72);
  resources.geometries.push(ring);
  const trim=new THREE.MeshStandardMaterial({color:color.light,metalness:.95,roughness:.16});
  resources.materials.push(trim);
  for(const z of [-thickness*.45,thickness*.45]){
    const band=new THREE.Mesh(ring,trim);band.position.z=z;root.add(band);
  }
  // Real milled sidewall teeth rotate with the cylinder. Instancing keeps
  // 60 facets to a single GPU draw, even on a low-power mobile device.
  const teethGeo=new THREE.BoxGeometry(Math.max(.35,radius*.017),
    Math.max(.35,radius*.025),thickness*.79);
  resources.geometries.push(teethGeo);
  const teeth=new THREE.InstancedMesh(teethGeo,trim,60);
  const dummy=new THREE.Object3D();
  for(let i=0;i<60;i++){
    const angle=i*Math.PI*2/60;
    dummy.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
    dummy.rotation.set(0,0,angle+Math.PI/2);
    dummy.updateMatrix();teeth.setMatrixAt(i,dummy.matrix);
  }
  teeth.instanceMatrix.needsUpdate=true;root.add(teeth);
  return root;
}
function shadowTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx?.scale(2,2);
  if(ctx){const gradient=ctx.createRadialGradient(64,64,6,64,64,62);
    gradient.addColorStop(0,'rgba(0,0,0,.46)');
    gradient.addColorStop(.5,'rgba(0,0,0,.19)');
    gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  }
  return new THREE.CanvasTexture(canvas);
}
/** The returned stop function cancels a midflight throw and frees all GPU
 * allocations; caller must dispose on unmount. */
export function tossCoin3D(opt:CoinTossOptions):()=>void{
  const {width,height,host}=opt;
  if(width<=0||height<=0)throw Error('Invalid coin toss viewport');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  const resources:Resources={geometries:[],materials:[],textures:[]};
  let canvas:HTMLCanvasElement|null=null,frame=0,ended=false;
  const cleanup=()=>{
    if(ended)return;
    ended=true;if(frame)cancelAnimationFrame(frame);canvas?.remove();
    for(const geometry of resources.geometries)geometry.dispose();
    for(const material of resources.materials)material.dispose();
    for(const texture of resources.textures)texture.dispose();
    renderer.dispose();renderer.forceContextLoss();
  };
  try{
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));
    renderer.setSize(width,height,false);renderer.setClearColor(0x000000,0);
    canvas=renderer.domElement;canvas.className='seneternal-coin-3d-layer';
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;'+
      'pointer-events:none;z-index:95;display:block;';
    host.appendChild(canvas);
    const scene=new THREE.Scene();
    const camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,1800);
    camera.position.set(width/2,height/2,1100);camera.lookAt(width/2,height/2,0);
    scene.add(new THREE.HemisphereLight(0xf2f7ff,0x293b47,2.65));
    const key=new THREE.DirectionalLight(0xffe8c7,3.35);key.position.set(-230,310,750);scene.add(key);
    const rim=new THREE.DirectionalLight(0xb4eaff,1.85);rim.position.set(260,-240,520);scene.add(rim);
    const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,-1040)});
    world.allowSleep=true;(world.solver as CANNON.GSSolver).iterations=18;
    const metal=new CANNON.Material('coin-metal'),felt=new CANNON.Material('felt'),
      solid=new CANNON.Material('hardcover-and-dice');
    world.addContactMaterial(new CANNON.ContactMaterial(metal,felt,{friction:.64,restitution:.27}));
    world.addContactMaterial(new CANNON.ContactMaterial(metal,solid,{friction:.48,restitution:.36}));
    world.addBody(new CANNON.Body({mass:0,material:felt,shape:new CANNON.Plane()}));
    function barrier(x:number,y:number,z:number,dx:number,dy:number,dz:number){
      const body=new CANNON.Body({mass:0,material:solid,
        shape:new CANNON.Box(new CANNON.Vec3(dx/2,dy/2,dz/2))});
      body.position.set(x,y,z);world.addBody(body);
    }
    const wall=28,tall=900;
    barrier(-wall/2,height/2,tall/2,wall,height+wall*2,tall);
    barrier(width+wall/2,height/2,tall/2,wall,height+wall*2,tall);
    barrier(width/2,-wall/2,tall/2,width+wall*2,wall,tall);
    barrier(width/2,height+wall/2,tall/2,width+wall*2,wall,tall);
    for(const book of opt.books){
      const w=book.right-book.left,h=book.bottom-book.top;
      if(w>1&&h>1&&[book.left,book.top,book.right,book.bottom].every(Number.isFinite))
        barrier((book.left+book.right)/2,height-(book.top+book.bottom)/2,18,w,h,36);
    }
    for(const piece of opt.solids.slice(-100)){
      const radius=clamp(piece.radius,3,100);
      if(![piece.x,piece.y].every(Number.isFinite))continue;
      const shape=piece.kind==='coin'
        ?new CANNON.Cylinder(radius,radius,3.5,24):new CANNON.Sphere(radius*.83);
      const fixed=new CANNON.Body({mass:0,material:solid});
      if(piece.kind==='coin')
        fixed.addShape(shape,undefined,new CANNON.Quaternion().setFromAxisAngle(
          new CANNON.Vec3(1,0,0),Math.PI/2));
      else fixed.addShape(shape);
      fixed.position.set(piece.x,height-piece.y,piece.kind==='coin'?1.75:radius*.83);
      world.addBody(fixed);
    }
    const radius=clamp(opt.radius,7,40),thickness=clamp(radius*.15,1.7,5.2);
    const mesh=coinMesh(radius,thickness,opt,resources);scene.add(mesh);
    const body=new CANNON.Body({mass:.042,material:metal,linearDamping:.09,
      angularDamping:.11,allowSleep:true,sleepSpeedLimit:.55,sleepTimeLimit:.72});
    body.addShape(new CANNON.Cylinder(radius,radius,thickness,40),undefined,
      new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1,0,0),Math.PI/2));
    body.position.set(clamp(opt.x,radius+2,width-radius-2),
      height-clamp(opt.y,radius+2,height-radius-2),Math.max(radius*.85,22));
    body.quaternion.setFromEuler((Math.random()-.5)*.2,
      (Math.random()-.5)*.2,Math.random()*Math.PI*2);
    const duration=clamp(opt.durationMs/1000,.025,.22);
    const vx=clamp(opt.deltaX/duration*.82,-1050,1050),
      vy=clamp(-opt.deltaY/duration*.82,-1050,1050);
    const speed=Math.hypot(vx,vy);
    body.velocity.set(vx,vy,clamp(145+speed*.20,170,410));
    const forward=Math.max(1,speed),flips=clamp(10+speed*.022,12,39);
    body.angularVelocity.set(-vy/forward*flips,vx/forward*flips,(Math.random()-.5)*10);
    world.addBody(body);
    const shadowMap=shadowTexture();resources.textures.push(shadowMap);
    const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,
      depthWrite:false,opacity:.48});resources.materials.push(shadowMaterial);
    const shadowGeo=new THREE.CircleGeometry(radius*1.28,48);
    resources.geometries.push(shadowGeo);
    const shadow=new THREE.Mesh(shadowGeo,shadowMaterial);scene.add(shadow);
    let previous=performance.now(),started=previous,settledAt=0,finished=false;
    const complete=()=>{
      if(finished||ended)return;finished=true;
      const normal=body.quaternion.vmult(new CANNON.Vec3(0,0,1));
      const q=body.quaternion;
      const rotation=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z));
      const result:CoinTossResult={x:clamp(body.position.x,radius,width-radius),
        y:clamp(height-body.position.y,radius,height-radius),
        heads:normal.z>=0,rotation};
      opt.onLand(result);
      // The 3D coin must stay visible through the authoritative game-state
      // commit and the next DOM/Pixi paint, even on slower devices.
      const handoffStarted=performance.now();
      const handoff=(time:number)=>{
        if(ended)return;
        if(time-handoffStarted>=190){cleanup();return;}
        frame=requestAnimationFrame(handoff);
      };
      frame=requestAnimationFrame(handoff);
    };
    const tick=(now:number)=>{
      if(ended||finished)return;
      try{
        const dt=Math.min(.05,(now-previous)/1000);previous=now;
        world.step(1/120,dt,8);
        // With an overhead orthographic camera, pure Z motion is hidden.
        // Apply the camera's shallow-pitch projection so the real altitude
        // is visibly separated from its ground contact shadow.
        mesh.position.set(body.position.x,body.position.y+body.position.z*.26,body.position.z);
        mesh.quaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);
        shadow.position.set(body.position.x,body.position.y,.18);
        const altitude=Math.max(0,body.position.z-radius*.14);
        shadow.scale.setScalar(1+Math.min(1.4,altitude/190));
        shadowMaterial.opacity=Math.max(.08,.5-altitude*.0019);
        renderer.render(scene,camera);
        const grounded=body.position.z<radius*.75&&body.velocity.length()<13&&
          body.angularVelocity.length()<2.5;
        if(grounded){if(!settledAt)settledAt=now;}else settledAt=0;
        if(body.sleepState===CANNON.Body.SLEEPING||
          (settledAt>0&&now-settledAt>420)||now-started>6500){complete();return;}
        frame=requestAnimationFrame(tick);
      }catch(error){cleanup();opt.onError?.(error);}
    };
    frame=requestAnimationFrame(tick);return cleanup;
  }catch(error){cleanup();throw error;}
}
