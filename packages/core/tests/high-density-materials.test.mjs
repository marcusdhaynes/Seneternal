import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeTextureQuality,texturePixelSize,TEXTURE_QUALITY_SIZES
} from '../../../apps/web/src/lib/materialDetail.ts';

test('texture presets provide 4× and 16× old 1K material pixel counts',()=>{
  assert.equal(texturePixelSize('balanced'),1024);
  assert.equal(texturePixelSize('high'),2048);
  assert.equal(texturePixelSize('ultra'),4096);
  assert.equal((TEXTURE_QUALITY_SIZES.high/1024)**2,4);
  assert.equal((TEXTURE_QUALITY_SIZES.ultra/1024)**2,16);
  assert.equal(normalizeTextureQuality(null),'high');
  assert.equal(normalizeTextureQuality('invalid'),'high');
});
test('all three table surfaces receive true quality-tiered materials with repeat',()=>{
  const canvas=readFileSync(new URL('../../../apps/web/src/components/TableCanvas.tsx',import.meta.url),'utf8');
  const materials=readFileSync(new URL('../../../apps/web/src/lib/tableMaterials.ts',import.meta.url),'utf8');
  assert.match(canvas,/tableMaterialTexture\(id,textureQuality\)/);
  assert.match(canvas,/new TilingSprite\(\{texture,width:BOARD_W,height:BOARD_W\}\)/);
  assert.match(canvas,/const pixelScale=targetTileWidth\/Math.max\(1,texture.width\)/);
  assert.match(canvas,/preloadCustomFloorTexture\(customFloorPattern\)/);
  assert.match(materials,/detailProcedural\(canvas,id,texturePixelSize\(quality\)\)/);
  assert.match(materials,/detailFabric\(image,texturePixelSize\(quality\),id\)/);
  assert.match(materials,/texture\.source\.maxAnisotropy=8/);
});
test('quality selection is saved and high resolution is default for new sessions',()=>{
  const app=readFileSync(new URL('../../../apps/web/src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/seneternal\.texture\.quality\.v1/);
  assert.match(app,/setTextureQuality\(e\.target\.value as TextureQuality\)/);
  assert.match(app,/2048 px \(Default\)/);
  assert.match(app,/2048\/Math\.max\(bitmap\.width,bitmap\.height\)/);
});
test('book, coin and dice face textures have real higher-resolution pixel allocations',()=>{
  const book=readFileSync(new URL('../../../apps/web/src/components/Book3D.ts',import.meta.url),'utf8');
  const coin=readFileSync(new URL('../../../apps/web/src/lib/Coin3D.ts',import.meta.url),'utf8');
  const dice=readFileSync(new URL('../../../apps/web/src/lib/Dice3DGeometry.ts',import.meta.url),'utf8');
  assert.match(book,/canvas\.width=2304;canvas\.height=3072/);
  assert.match(book,/const width=1800,height=2376/);
  assert.match(coin,/canvas\.width=canvas\.height=1536/);
  assert.match(dice,/canvas\.width=512;canvas\.height=512/);
  assert.match(dice,/const density=2,cell=72\*density/);
});
