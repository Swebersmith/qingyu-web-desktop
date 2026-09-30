import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestGroups,validateGroups,folderMetrics} from '../organizer.js';

const apps=[
  {id:'github',name:'GitHub',url:'https://github.com'},
  {id:'gitlab',name:'GitLab',url:'https://gitlab.com'},
  {id:'music',name:'网易云音乐',url:'https://music.163.com'},
  {id:'spotify',name:'Spotify',url:'https://open.spotify.com'},
  {id:'private',name:'自己的站点',url:'https://example.com'},
  {id:'settings',name:'设置',system:'settings'}
];

test('suggestions infer from names/domains; unique and system apps stay ungrouped',()=>{
  assert.deepEqual(suggestGroups(apps),[{name:'开发工具',appIds:['github','gitlab']},{name:'音乐',appIds:['music','spotify']}]);
});
test('model suggestions cannot duplicate, invent, or select system app IDs',()=>{
  assert.deepEqual(validateGroups([
    {name:' 开发 ',appIds:['github','github','gitlab','invented','settings']},
    {name:'混合',appIds:['github','music','spotify']},
    {name:'单个',appIds:['private']},
    {name:'',appIds:['private','spotify']}
  ],apps),[{name:'开发',appIds:['github','gitlab']},{name:'混合',appIds:['music','spotify']}]);
  assert.deepEqual(validateGroups({groups:[]},apps),[]);
});
test('complete folder cells fit phone, tablet, wide and short folder sizes',()=>{
  for(const [width,height] of [[170,159],[195,168],[275,258],[90,168],[295,78],[160,110]]){
    const metrics=folderMetrics(width,height),cellWidth=(width-20-6*(metrics.columns-1))/metrics.columns,cellHeight=(height-46-6*(metrics.rows-1))/metrics.rows;
    assert.ok(metrics.icon<=cellWidth-4,`${width}×${height}: icon width`);
    assert.ok(metrics.icon+(metrics.labels?19:4)<=cellHeight,`${width}×${height}: icon and label height`);
    assert.equal(metrics.capacity,metrics.columns*metrics.rows);
    assert.ok(metrics.capacity>=1);
  }
  assert.equal(folderMetrics(60,78,true).capacity,9);
});
