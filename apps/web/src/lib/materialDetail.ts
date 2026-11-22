/**
 * High-density material detail pass. Built once on selection and cached by
 * material+quality; all tabletop frames use the resulting GPU texture.
 *
 * The underlying user-supplied WebP artwork is preserved as color/albedo.
 * Native-resolution microfibers and fine pore/stone/wood detail improve
 * apparent material fidelity, without pretending lost JPEG/WebP detail can
 * be reconstructed from the original downsample.
 */
export type TextureQuality = 'balanced'|'high'|'ultra';
export const TEXTURE_QUALITY_SIZES:Record<TextureQuality,number>={
  balanced:1024, high:2048, ultra:4096
};
export function normalizeTextureQuality(value:unknown):TextureQuality{
  return value==='balanced'||value==='ultra'||value==='high'?value:'high';
}
export function texturePixelSize(quality:TextureQuality):number{
  return TEXTURE_QUALITY_SIZES[quality];
}
const hashSeed=(input:string)=>{
  let n=2166136261;
  for(let i=0;i<input.length;i++)n=Math.imul(n^input.charCodeAt(i),16777619)>>>0;
  return n;
};
function seeded(seed:number):()=>number{
  let x=seed>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
}
function wrappedPath(ctx:CanvasRenderingContext2D,size:number,
  x:number,y:number,dx:number,dy:number){
  const copiesX=[0],copiesY=[0];
  if(x<Math.abs(dx)+2)copiesX.push(size);
  if(x>size-Math.abs(dx)-2)copiesX.push(-size);
  if(y<Math.abs(dy)+2)copiesY.push(size);
  if(y>size-Math.abs(dy)-2)copiesY.push(-size);
  for(const ox of copiesX)for(const oy of copiesY){
    ctx.moveTo(x+ox,y+oy);ctx.lineTo(x+dx+ox,y+dy+oy);
  }
}
/** Edge-softened, real high-DPI fabric detail from the provided artwork. */
export function detailFabric(
  image:CanvasImageSource,size:number,seedText:string
):HTMLCanvasElement{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('High-resolution felt canvas unavailable');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,0,0,size,size);
  const rng=seeded(hashSeed(seedText));
  const count=Math.round(size*size*.012);
  // Two independent fine-fiber layers give soft felt naps visible at deep
  // zoom, without a giant static texture download or per-frame shading.
  for(let layer=0;layer<2;layer++){
    ctx.strokeStyle=layer===0?'rgba(238,244,225,.095)':'rgba(0,17,12,.125)';
    ctx.lineWidth=layer===0?.57:.68;
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const x=rng()*size,y=rng()*size;
      const a=rng()*6.283185307179586;
      const len=.7+rng()*2.15;
      wrappedPath(ctx,size,x,y,Math.cos(a)*len,Math.sin(a)*len);
    }
    ctx.stroke();
  }
  return canvas;
}
/** Repaint the visual microstructure at native resolution. Original albedo
 * is rendered at high quality and then given distinct material-specific
 * fibers, pores, veins, grain and subtle high-frequency light response. */
export function detailProcedural(base:HTMLCanvasElement,id:string,size:number)
  :HTMLCanvasElement{
  if(base.width===size&&size===1024)return base;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const g=canvas.getContext('2d',{alpha:false});
  if(!g)throw Error('High-DPI material canvas unavailable');
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(base,0,0,size,size);
  const rng=seeded(hashSeed(id));
  const felt=id.includes('felt'),wood=['walnut','oak','mahogany'].some(type=>id.includes(type)),
    marble=id.includes('marble'),stone=id.includes('slate'),
    brass=id.includes('brass'),leather=id==='leather',glass=id==='obsidian-glass';
  if(felt){
    const count=Math.round(size*size*.018);
    for(let layer=0;layer<2;layer++){
      g.beginPath();
      g.strokeStyle=layer===0?'rgba(242,226,179,.095)':'rgba(0,14,16,.14)';
      g.lineWidth=layer===0?.65:.85;
      for(let i=0;i<count;i++){
        const x=rng()*size,y=rng()*size,a=rng()*Math.PI*2,len=.55+rng()*2.2;
        wrappedPath(g,size,x,y,Math.cos(a)*len,Math.sin(a)*len);
      }
      g.stroke();
    }
  }else if(wood){
    // Continuous vessel lines rather than repetitive high-contrast
    // stripes, drawn in three native-pixel engraving widths.
    for(let layer=0;layer<3;layer++){
      g.beginPath();
      g.lineWidth=[.45,.75,1.2][layer];
      g.strokeStyle=['rgba(14,7,3,.2)','rgba(251,207,122,.11)','rgba(11,4,2,.14)'][layer];
      const count=Math.round(size/[13,18,30][layer]);
      for(let i=0;i<count;i++){
        const y=rng()*size,amplitude=3+rng()*9,phase=rng()*Math.PI*2;
        for(const offset of [-size,0,size]){
          g.moveTo(0,y+offset);
          for(let x=0;x<=size;x+=14){
            const travel=y+offset+Math.sin(x*.013+phase)*amplitude+
              Math.sin(x*.037+phase)*amplitude*.24;
            g.lineTo(x,travel);
          }
        }
      }
      g.stroke();
    }
    g.fillStyle='rgba(18,9,5,.13)';
    for(let i=0;i<size*6;i++){
      const x=rng()*size,y=rng()*size;
      g.fillRect(x,y,.35+rng()*.6,.55+rng()*1.4);
    }
  }else if(marble){
    for(let i=0;i<Math.round(size/36);i++){
      const phase=rng()*Math.PI*2,shift=rng()*size,alpha=.09+rng()*.12;
      g.beginPath();g.strokeStyle='rgba(65,71,74,'+alpha.toFixed(3)+')';
      g.lineWidth=.25+rng()*1.05;
      for(let x=-12;x<=size+12;x+=8){
        const yy=(shift+x*.4+Math.sin(x*.014+phase)*34+
          Math.sin(x*.053+phase)*7+size*3)%size;
        if(x===-12)g.moveTo(x,yy);else g.lineTo(x,yy);
      }
      g.stroke();
    }
  }else if(stone){
    for(let layer=0;layer<2;layer++){
      g.beginPath();g.fillStyle=layer?'rgba(235,243,236,.11)':'rgba(9,18,23,.16)';
      for(let i=0;i<size*14;i++){
        const x=rng()*size,y=rng()*size,r=.25+rng()*.95;
        g.moveTo(x+r,y);g.arc(x,y,r,0,6.283185307179586);
      }
      g.fill();
    }
  }else if(brass){
    // Fine directional brushing makes the gold alloy look physically
    // different from wood grain or felt, while preserving the generated
    // image's warm antique color beneath the micro-scratches.
    for(let layer=0;layer<2;layer++){
      g.beginPath();
      g.strokeStyle=layer===0?'rgba(255,237,183,.12)':'rgba(31,19,6,.16)';
      g.lineWidth=layer===0?.38:.75;
      for(let i=0;i<size*3;i++){
        const x=rng()*size,y=rng()*size,len=8+rng()*160;
        wrappedPath(g,size,x,y,len,(rng()-.5)*.8);
      }
      g.stroke();
    }
  }else if(leather){
    for(let layer=0;layer<2;layer++){
      g.beginPath();
      g.strokeStyle=layer?'rgba(240,181,118,.10)':'rgba(29,12,9,.16)';
      g.lineWidth=.6;
      for(let i=0;i<size*24;i++){
        const x=rng()*size,y=rng()*size;
        wrappedPath(g,size,x,y,.2+rng()*1.9,(rng()-.5)*1.4);
      }
      g.stroke();
    }
  }else if(glass){
    const glaze=g.createLinearGradient(0,0,size,size);
    glaze.addColorStop(0,'rgba(255,255,255,.035)');
    glaze.addColorStop(.38,'rgba(214,240,251,.005)');
    glaze.addColorStop(.48,'rgba(223,248,255,.092)');
    glaze.addColorStop(.56,'rgba(224,249,255,.004)');
    glaze.addColorStop(1,'rgba(4,8,14,.12)');
    g.fillStyle=glaze;g.fillRect(0,0,size,size);
  }
  return canvas;
}
