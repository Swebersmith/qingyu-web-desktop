import test from 'node:test';
import assert from 'node:assert/strict';
import {GLASS_PALETTES,contrastRatio,luminance,regionColors,labelAppearance,glassAppearance,glassBackground} from '../appearance-model.js';

test('contrast uses linear light rather than average RGB brightness',()=>{
  assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
  assert.equal(contrastRatio([80,80,80],[80,80,80]),1);
  assert.ok(luminance([0,255,0])>luminance([255,0,0]));
});
test('bare captions change ink on bright and dark backgrounds without plates',()=>{
  assert.equal(labelAppearance([[255,255,255]]).tone,'dark');
  assert.equal(labelAppearance([[0,0,0]]).tone,'light');
  assert.equal(labelAppearance([[66,88,117]]).tone,'light');
  assert.equal(labelAppearance([[0,0,0],[255,255,255]]).busy,true);
  assert.equal(labelAppearance([]).busy,true);
});
test('uniform backgrounds preserve translucency while keeping secondary text readable',()=>{
  for(const colors of [[[255,255,255]],[[0,0,0]],[[66,88,117]],[[210,224,209]],[[184,211,196]]]){
    const {tone,opacity}=glassAppearance(colors);assert.ok(opacity<=.4,`unnecessary opaque tint on ${colors}`);
    assert.ok(colors.every(color=>contrastRatio(GLASS_PALETTES[tone].muted,glassBackground(color,tone,opacity))>=5.1));
  }
});
test('small brightness changes do not flicker caption ink, while a new wallpaper still changes it',()=>{
  const first=labelAppearance([[130,130,130]]).tone;assert.equal(labelAppearance([[134,134,134]],first).tone,first);
  assert.equal(labelAppearance([[255,255,255]],'light').tone,'dark');assert.equal(labelAppearance([[0,0,0]],'dark').tone,'light');
});
test('a bright or dark patch beneath a caption is included in the contrast budget',()=>{
  for(const colors of [[[0,0,0],[255,255,255]],[[30,50,60],[220,180,110],[245,245,245]],[[10,90,130],[255,120,30],[10,10,10]]]){
    const {tone,opacity}=glassAppearance(colors);assert.ok(opacity<.8);
    for(const color of colors)assert.ok(contrastRatio(GLASS_PALETTES[tone].muted,glassBackground(color,tone,opacity))>=5.1,`${tone} ${opacity} ${color}`);
  }
});
test('unreadable remote pixels use a conservative palette without breaking the image',()=>{
  const {tone,opacity}=glassAppearance([]);for(const color of [[0,0,0],[255,255,255]])assert.ok(contrastRatio(GLASS_PALETTES[tone].muted,glassBackground(color,tone,opacity))>=5.1);
});
test('local sampling clamps edge captions and does not include invisible transparent pixels',()=>{
  const image={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,0])};
  assert.deepEqual(regionColors(image,{x:0,y:0,width:1,height:1}),[[255,0,0]]);
  assert.deepEqual(regionColors(image,{x:1,y:0,width:1,height:1}),[[0,255,0]]);
  assert.deepEqual(regionColors(image,{x:-10,y:-10,width:11,height:11}),[[255,0,0]]);
  assert.deepEqual(regionColors(image,{x:1,y:1,width:1,height:1}),[]);
});
