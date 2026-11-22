import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../../../apps/web/src/App.tsx',import.meta.url),'utf8');
const canvas=readFileSync(new URL('../../../apps/web/src/components/TableCanvas.tsx',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../../../.github/workflows/deploy-dreamhost.yml',import.meta.url),'utf8');

test('one Appearance location contains Table, Rim and Floor and every other visual category',()=>{
  assert.match(app,/id:'appearance',label:'Appearance'/);
  assert.match(app,/\['table','rim','floor'\] as const/);
  for(const section of ['Table Surfaces','Book','Playmat &amp; Trays','Dice','Coins','Button Appearance']){
    assert.ok(app.includes(section),'Missing appearance setting: '+section);
  }
  assert.doesNotMatch(app,/settingsPage==='playmat'/);
  assert.match(app,/id:'general',label:'Controls'/);
});
test('secondary settings and help are compact expandable details',()=>{
  for(const item of ['Camera &amp; View Guide','Stacks &amp; Selection Guide',
    'Dice &amp; Coin Interactions','Updates &amp; Version']){
    assert.ok(app.includes('<summary>'+item)||app.includes('<summary>'+item+' <span'),
      'Not collapsible: '+item);
  }
});
test('Coin3D is statically bundled rather than fetched mid-throw',()=>{
  assert.match(canvas,/import \{tossCoin3D\} from '\.\.\/lib\/Coin3D';/);
  assert.doesNotMatch(canvas,/import\('\.\.\/lib\/Coin3D'\)/);
  assert.equal((canvas.match(/stopFlight=tossCoin3D\(/g)||[]).length,2);
});
test('deployment retains old fingerprinted chunks for already open browser tabs',()=>{
  assert.match(workflow,/--filter='P \/assets\/\*\*\*'/);
  assert.match(workflow,/--delete/);
});
