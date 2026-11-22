import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMERALD_FELT_REFERENCE_URL} from '../../../apps/web/src/lib/emeraldFeltReference.ts';

test('bundled emerald felt uses the supplied image rather than a procedural substitute',()=>{
  assert.ok(EMERALD_FELT_REFERENCE_URL.startsWith('data:image/webp;base64,'));
  const buffer=Buffer.from(EMERALD_FELT_REFERENCE_URL.split(',')[1],'base64');
  assert.equal(buffer.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(buffer.subarray(8,12).toString('ascii'),'WEBP');
  assert.equal(buffer.length,9448,'Embedded WebP must be complete and untruncated');
});
test('the supplied emerald felt is available as a Table material and the default Floor',()=>{
  const materials=readFileSync(new URL('../../../apps/web/src/lib/tableMaterials.ts',import.meta.url),'utf8');
  assert.match(materials,/emerald-felt-tile/);
  assert.match(materials,/Emerald Felt · Supplied Repeating Pattern/);
  assert.match(materials,/floor:'emerald-felt-tile'/);
});
test('the supplied image is GPU-tiled rather than stretched across the tabletop',()=>{
  const canvas=readFileSync(new URL('../../../apps/web/src/components/TableCanvas.tsx',import.meta.url),'utf8');
  assert.match(canvas,/const builtin=id==='emerald-felt-tile'/);
  assert.match(canvas,/new TilingSprite\(\{texture,width:BOARD_W,height:BOARD_W\}\)/);
  assert.match(canvas,/preloadEmeraldFeltTexture\(\)/);
});
