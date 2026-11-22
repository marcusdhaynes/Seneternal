import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  GENERATED_MATERIAL_ATLAS_URI,GENERATED_MATERIAL_SLOTS,
  generatedPreviewStyle,isGeneratedMaterial
} from '../../../apps/web/src/lib/generatedMaterialAtlas.ts';

test('ten generated material images are actually bundled, intact and offline',()=>{
  const prefix='data:image/webp;base64,';
  assert.ok(GENERATED_MATERIAL_ATLAS_URI.startsWith(prefix));
  const b64=GENERATED_MATERIAL_ATLAS_URI.slice(prefix.length);
  assert.equal(b64.length,7592,'Generated atlas must have the full embedded data');
  const bytes=Buffer.from(b64,'base64');
  assert.equal(bytes.length,5694);
  assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '515adec598416beceaaa7446af0b2b17dfcca7c6e0cc8fd6407f707715a0aa54');
  assert.equal(Object.keys(GENERATED_MATERIAL_SLOTS).length,10);
  assert.ok(Object.entries(GENERATED_MATERIAL_SLOTS).every(([,v])=>
    Number.isInteger(v.column)&&v.column>=0&&v.column<5&&v.row>=0&&v.row<2));
  assert.equal(isGeneratedMaterial('brushed-brass'),true);
  assert.equal(isGeneratedMaterial('premium-oak'),true);
  assert.equal(isGeneratedMaterial('marble'),false);
  assert.equal(generatedPreviewStyle('premium-mahogany').backgroundPosition,'25% 100%');
});
test('material renderer uses actual generated albedo, plus high-DPI material-specific detail',()=>{
  const materials=readFileSync(new URL('../../../apps/web/src/lib/tableMaterials.ts',import.meta.url),'utf8');
  const detail=readFileSync(new URL('../../../apps/web/src/lib/materialDetail.ts',import.meta.url),'utf8');
  const canvas=readFileSync(new URL('../../../apps/web/src/components/TableCanvas.tsx',import.meta.url),'utf8');
  for(const id of Object.keys(GENERATED_MATERIAL_SLOTS)){
    assert.ok(materials.includes(`id:'${id}'`),'Missing registered material '+id);
  }
  assert.match(materials,/preloadGeneratedMaterialAtlas\(\)/);
  assert.match(materials,/drawImage\(generatedAtlasImage,column\*128,row\*128,128,128,0,0,128,128\)/);
  assert.match(materials,/detailFabric\(base,size,id\)/);
  assert.match(materials,/detailProcedural\(base,id,size\)/);
  assert.match(detail,/id\.includes\('brass'\)/);
  assert.match(canvas,/preloadGeneratedMaterialAtlas\(\)/);
});
test('Settings previews all generated materials and selects Table, Rim and Floor independently',()=>{
  const app=readFileSync(new URL('../../../apps/web/src/App.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../../apps/web/src/styles.css',import.meta.url),'utf8');
  assert.match(app,/seneternal-material-gallery/);
  assert.match(app,/generatedPreviewStyle\(id\)/);
  assert.match(app,/materialPreviewSurface/);
  assert.match(app,/role="radiogroup"/);
  assert.match(app,/role="radio"/);
  assert.match(app,/setTableMaterials\(current=>\(\{\.\.\.current,\[materialPreviewSurface\]:material\.id\}\)\)/);
  assert.match(css,/seneternal-material-choice-swatch/);
  assert.match(css,/seneternal-material-options/);
});
