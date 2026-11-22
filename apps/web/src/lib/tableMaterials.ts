import {Texture} from 'pixi.js';
import {EMERALD_FELT_REFERENCE_URL} from './emeraldFeltReference';
import {GRAY_FELT_REFERENCE_URL} from './grayFeltReference';
import {detailFabric,detailProcedural,normalizeTextureQuality,texturePixelSize,type TextureQuality} from './materialDetail';
export {normalizeTextureQuality,texturePixelSize,type TextureQuality} from './materialDetail';

/** Independent, GPU-cached materials for the tabletop, its wooden rim and
 * the surrounding floor. Nothing is fetched and no per-frame renderer runs. */
export type TableMaterialId =
  'emerald-felt'|'burgundy-felt'|'midnight-felt'|'walnut'|'oak'|
  'mahogany'|'slate'|'marble'|'leather'|'obsidian-glass'|'custom-pattern'|'emerald-felt-tile'|'gray-felt-tile';
export interface TableMaterials {
  table:TableMaterialId;
  rim:TableMaterialId;
  floor:TableMaterialId;
}
export const DEFAULT_TABLE_MATERIALS:TableMaterials={
  table:'emerald-felt',rim:'walnut',floor:'emerald-felt-tile'
};
export const TABLE_MATERIAL_OPTIONS:{id:TableMaterialId;label:string}[]=[
  {id:'emerald-felt',label:'Emerald billiard felt'},
  {id:'emerald-felt-tile',label:'Emerald Felt · Supplied Repeating Pattern'},
  {id:'gray-felt-tile',label:'Gray Felt · Supplied Repeating Pattern'},
  {id:'burgundy-felt',label:'Burgundy tournament felt'},
  {id:'midnight-felt',label:'Midnight blue felt'},
  {id:'walnut',label:'Oiled black walnut'},
  {id:'oak',label:'Honey oak wood'},
  {id:'mahogany',label:'Polished mahogany'},
  {id:'slate',label:'Natural charcoal slate'},
  {id:'marble',label:'Ivory veined marble'},
  {id:'leather',label:'Cognac full-grain leather'},
  {id:'obsidian-glass',label:'Smoked obsidian glass'},
  {id:'custom-pattern',label:'My repeating floor pattern'}
];
const colors:Record<TableMaterialId,[number,number,number]>={
  'emerald-felt':[29,77,61], 'burgundy-felt':[96,31,48],
  'midnight-felt':[31,47,75], walnut:[88,56,35],
  oak:[158,112,62], mahogany:[98,39,33], slate:[53,61,65],
  marble:[206,201,182], leather:[120,64,40],
  'obsidian-glass':[20,29,36], 'custom-pattern':[53,61,65], 'emerald-felt-tile':[18,109,73], 'gray-felt-tile':[91,91,91]
};
export function normalizeTableMaterials(value:unknown):TableMaterials{
  const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const valid=(id:unknown):id is TableMaterialId=>
    typeof id==='string'&&Object.prototype.hasOwnProperty.call(colors,id);
  return {
    table:valid(v.table)?v.table:DEFAULT_TABLE_MATERIALS.table,
    rim:valid(v.rim)?v.rim:DEFAULT_TABLE_MATERIALS.rim,
    floor:valid(v.floor)?v.floor:DEFAULT_TABLE_MATERIALS.floor
  };
}
const cache=new Map<TableMaterialId,Texture>();
const detailedCache=new Map<string,Texture>();
const referenceImages=new Map<TableMaterialId,HTMLImageElement>();
/** GPU-friendly trilinear/mipmap sampling also eliminates sparkle at zoomed
 * out angles, while anisotropic sampling retains grain clarity at a tilt. */
function configureSampling(texture:Texture):Texture{
  texture.source.magFilter='linear';
  texture.source.minFilter='linear';
  texture.source.mipmapFilter='linear';
  texture.source.maxAnisotropy=8;
  texture.source.autoGenerateMipmaps=true;
  return texture;
}
let emeraldTexturePromise:Promise<Texture>|null=null;
let grayTexturePromise:Promise<Texture>|null=null;
/** Decode the bundled WebP before creating a Pixi texture. Pixi v8's
 * Texture.from(URL) only retrieves previously loaded assets, so an unprimed
 * data URI can silently render empty. Preloading avoids blank table tiles. */
export function preloadEmeraldFeltTexture():Promise<Texture>{
  const loaded=cache.get('emerald-felt-tile');
  if(loaded)return Promise.resolve(loaded);
  if(emeraldTexturePromise)return emeraldTexturePromise;
  emeraldTexturePromise=(async()=>{
    const img=new Image();
    img.src=EMERALD_FELT_REFERENCE_URL;
    if(typeof img.decode==='function')await img.decode();
    else await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(Error('Emerald felt texture could not be decoded'));
    });
    const texture=configureSampling(Texture.from(img));
    referenceImages.set('emerald-felt-tile',img);
    cache.set('emerald-felt-tile',texture);
    return texture;
  })().catch(error=>{
    emeraldTexturePromise=null;
    throw error;
  });
  return emeraldTexturePromise;
}
/** Loads the user's bundled gray reference texture once. Unlike using
 * Texture.from(dataURI), the decoded image source is always ready before
 * the Pixi TilingSprite is composed, avoiding an empty first frame. */
export function preloadGrayFeltTexture():Promise<Texture>{
  const loaded=cache.get('gray-felt-tile');
  if(loaded)return Promise.resolve(loaded);
  if(grayTexturePromise)return grayTexturePromise;
  grayTexturePromise=(async()=>{
    const img=new Image();
    img.src=GRAY_FELT_REFERENCE_URL;
    if(typeof img.decode==='function')await img.decode();
    else await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(Error('Gray felt texture could not be decoded'));
    });
    const texture=configureSampling(Texture.from(img));
    referenceImages.set('gray-felt-tile',img);
    cache.set('gray-felt-tile',texture);
    return texture;
  })().catch(error=>{
    grayTexturePromise=null;
    throw error;
  });
  return grayTexturePromise;
}
function random(seed:number):()=>number{
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
const clamp=(n:number)=>Math.min(255,Math.max(0,Math.round(n)));
/** Full material generator. Balanced=1K, High=2K, Ultra=4K.
 * Individual surfaces are cached and never regenerated per animation frame. */
export function tableMaterialTexture(
  id:TableMaterialId,requestedQuality:TextureQuality='high'
):Texture{
  const quality=normalizeTextureQuality(requestedQuality);
  const key=id+':'+quality;
  const existing=detailedCache.get(key);
  if(existing&&!existing.destroyed)return existing;
  if(id==='emerald-felt-tile'||id==='gray-felt-tile'){
    const image=referenceImages.get(id);
    if(!image)return cache.get(id)??Texture.WHITE;
    // Original supplied artwork remains the albedo. Additional microscopic
    // felt fibers are drawn at actual 2K/4K resolution instead of scaling
    // the former 256/512px color map and calling it restored detail.
    const canvas=detailFabric(image,texturePixelSize(quality),id);
    const output=configureSampling(Texture.from(canvas));
    detailedCache.set(key,output);
    return output;
  }
  const size=1024,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Table material canvas unavailable');
  const c=colors[id],isFelt=id.endsWith('felt'),
    wood=['walnut','oak','mahogany'].includes(id),
    stone=id==='slate'||id==='marble',glass=id==='obsidian-glass';
  const seed=Array.from(id).reduce((n,ch)=>Math.imul(n,31)+ch.charCodeAt(0),121);
  const rand=random(seed);
  const pixels=ctx.createImageData(size,size),data=pixels.data;
  const noiseBand=new Float32Array(size);
  let wander=0;
  for(let y=0;y<size;y++){
    wander=wanderNoise(wander,rand);
    noiseBand[y]=wander;
  }
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const at=(y*size+x)*4,grain=rand()-.5;
      const woodGrain=wood?Math.sin((y+noiseBand[y]*28+Math.sin(x*.012)*18)*.095)*13+
        Math.sin((y+noiseBand[y]*12)*.31)*5:0;
      const marbleVein=id==='marble'?Math.sin((x+y*.46+Math.sin(y*.02)*30)*.029)*8:0;
      const texture=isFelt?grain*16:wood?grain*10+woodGrain:
        stone?grain*19+marbleVein:glass?grain*3:grain*11+Math.sin(y*.21+noiseBand[y])*3;
      const light=1+Math.sin(x/size*Math.PI)*.045-
        Math.abs(y-size*.45)/size*.045;
      data[at]=clamp(c[0]*light+texture);
      data[at+1]=clamp(c[1]*light+texture);
      data[at+2]=clamp(c[2]*light+texture);
      data[at+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  if(isFelt){
    for(let i=0;i<12500;i++){
      const x=rand()*size,y=rand()*size;
      ctx.fillStyle=rand()>.52?'#e7d9a70d':'#020b090e';
      ctx.fillRect(x,y,.4+rand()*1.2,.4+rand()*2.4);
    }
  }else if(wood){
    for(let i=0;i<300;i++){
      const x=rand()*size,y=rand()*size;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.bezierCurveTo(x-9,y+40,x+8,y+90,x+(rand()-.5)*14,y+190);
      ctx.strokeStyle=i%3===0?'#ffe5b111':'#0d070b18';
      ctx.lineWidth=.6+rand()*1.2;ctx.stroke();
    }
  }else if(stone){
    for(let i=0;i<(id==='marble'?18:140);i++){
      const x=rand()*size,y=rand()*size;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.bezierCurveTo(x+30,y-25,x-60,y-110,x+75,y-165);
      ctx.strokeStyle=id==='marble'?'#606a6c36':'#b7c6c326';
      ctx.lineWidth=(id==='marble'?1.7:.6)+rand()*1.4;ctx.stroke();
    }
  }else if(glass){
    const shine=ctx.createLinearGradient(0,0,size,size);
    shine.addColorStop(0,'#ffffff12');shine.addColorStop(.34,'#ffffff03');
    shine.addColorStop(.43,'#c4f7ff20');shine.addColorStop(.54,'#ffffff00');
    shine.addColorStop(1,'#0000003a');
    ctx.fillStyle=shine;ctx.fillRect(0,0,size,size);
  }else{
    for(let i=0;i<2600;i++){
      const x=rand()*size,y=rand()*size;
      ctx.beginPath();ctx.arc(x,y,.2+rand()*.95,0,Math.PI*2);
      ctx.fillStyle='#090a0b18';ctx.fill();
    }
  }
  const detailed=detailProcedural(canvas,id,texturePixelSize(quality));
  const texture=configureSampling(Texture.from(detailed));
  detailedCache.set(key,texture);
  return texture;
}
function wanderNoise(value:number,rand:()=>number):number{
  return Math.max(-1,Math.min(1,value+(rand()-.5)*.12));
}

/** User-supplied exact seamless tile is loaded locally, never uploaded.
 * Texture.from caches per source URL; PNG is preferred for lossless fidelity. */
export function customFloorTexture(imageDataUrl:string):Texture{
  if(!/^data:image\/(?:png|webp|jpeg);base64,/.test(imageDataUrl)||
    imageDataUrl.length>3_000_000)throw Error('Unsupported floor tile');
  return Texture.from(imageDataUrl);
}
/** Optional memory reclamation after an already-rendered table is replaced.
 * Disposes only inactive resolutions/materials; active ones stay cached. */
export function releaseUnusedMaterialTextures(
  selected:readonly TableMaterialId[],quality:TextureQuality
):void{
  const keep=new Set(selected.map(id=>id+':'+quality));
  for(const [key,texture] of detailedCache){
    if(keep.has(key))continue;
    detailedCache.delete(key);
    texture.destroy(true);
  }
}
