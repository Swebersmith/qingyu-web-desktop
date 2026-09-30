import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestGroups,validateGroups,folderMetrics,organizationSignals} from '../organizer.js';

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
test('services on the same platform use their specific purpose, not their shared brand',()=>{
  const input=[['search','Google','https://google.com'],['bing','Bing','https://bing.com'],['drive','Google Drive','https://drive.google.com'],['docs','Google Docs','https://docs.google.com'],['translate','Google 翻译','https://translate.google.com'],['deepl','DeepL','https://deepl.com'],['film','豆瓣电影','https://movie.douban.com'],['video','YouTube','https://youtube.com'],['dmusic','豆瓣音乐','https://music.douban.com'],['spotify','Spotify','https://spotify.com'],['fake','自用','https://github.com.attacker.example'],['fake2','自用','https://notgoogle.com']].map(([id,name,url])=>({id,name,url}));
  assert.deepEqual(suggestGroups(input),[{name:'搜索',appIds:['search','bing']},{name:'效率办公',appIds:['drive','docs']},{name:'翻译工具',appIds:['translate','deepl']},{name:'影音',appIds:['film','video']},{name:'音乐',appIds:['dmusic','spotify']}]);
});
test('purpose paths are preserved but private segments, query, credentials and fragments are omitted',()=>{
  assert.deepEqual(organizationSignals({url:'https://user:secret@example.com/private123/courses/account-token?token=hidden#private'}),{domain:'example.com',path:'/courses'});
  const input=[{id:'c1',name:'我的收藏',url:'https://youtube.com/learning'},{id:'c2',name:'我的收藏',url:'https://bilibili.com/courses'},{id:'v1',name:'视频',url:'https://youtube.com/watch'},{id:'v2',name:'视频',url:'https://bilibili.com/anime'}];
  assert.deepEqual(suggestGroups(input),[{name:'学习阅读',appIds:['c1','c2']},{name:'影音',appIds:['v1','v2']}]);
});
test('low-confidence groups stay untouched and explanatory metadata is bounded',()=>{
  assert.deepEqual(validateGroups([{name:'猜测',appIds:['github','gitlab'],confidence:.5},{name:'开发',appIds:['github','gitlab'],confidence:.95,reason:'  代码协作  '}],apps),[{name:'开发',appIds:['github','gitlab'],confidence:.95,reason:'代码协作'}]);
});
