import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {GRAY_FELT_REFERENCE_URL} from '../../../apps/web/src/lib/grayFeltReference.ts';

test('bundled gray felt contains the entire user-provided texture',()=>{
  assert.ok(GRAY_FELT_REFERENCE_URL.startsWith('data:image/webp;base64,'));
  const data=Buffer.from(GRAY_FELT_REFERENCE_URL.split(',')[1],'base64');
  assert.equal(data.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(data.subarray(8,12).toString('ascii'),'WEBP');
  assert.equal(data.length,4788,'Embedded WebP cannot be truncated');
  assert.equal(createHash('sha256').update(data).digest('hex'),
    '3ed6215d175db21a1d2f13a44ce6c9153ae51c58af63d80d52754fdf5fdcbcdb');
});
test('gray felt is a saved selectable material and keeps the green default',()=>{
  const materials=readFileSync(new URL('../../../apps/web/src/lib/tableMaterials.ts',import.meta.url),'utf8');
  assert.match(materials,/gray-felt-tile/);
  assert.match(materials,/Gray Felt · Supplied Repeating Pattern/);
  assert.match(materials,/preloadGrayFeltTexture/);
  assert.match(materials,/floor:'emerald-felt-tile'/);
  const app=readFileSync(new URL('../../../apps/web/src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/\['table','rim','floor'\]/);
  assert.match(app,/TABLE_MATERIAL_OPTIONS/);
});
test('gray felt is loaded before rendering and repeated rather than stretched',()=>{
  const canvas=readFileSync(new URL('../../../apps/web/src/components/TableCanvas.tsx',import.meta.url),'utf8');
  assert.match(canvas,/id==='gray-felt-tile'/);
  assert.match(canvas,/new TilingSprite\(\{texture,width:BOARD_W,height:BOARD_W\}\)/);
  assert.match(canvas,/preloadGrayFeltTexture\(\)/);
});
