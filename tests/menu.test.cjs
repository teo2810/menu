const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const presets=JSON.parse(source.match(/var ASILO_PRESETS = (\[.*\]);/)[1]);
const legacy=JSON.parse(source.match(/var ASILO_LEGACY_PRESETS = (\[.*\]);/)[1]);
const clone=x=>JSON.parse(JSON.stringify(x));
function context(){
 const ctx={Date,JSON,console,STORE:"menu-library-v3",ASILO_PRESETS:clone(presets),ASILO_LEGACY_PRESETS:clone(legacy),DAYS:['lunedi','martedi','mercoledi','giovedi','venerdi'].map(id=>({id})),DEFAULT_SECTIONS:presets[0].sections,ALLERGENS:{14:'Molluschi'},state:{menus:[],activeId:null},window:{},document:{getElementById:()=>null},localStorage:{setItem(){}},cloudApplying:false,getCloudKey:()=>'',queueCloudSave(){},renderAll(){},toast(){},goTab(){}};
 vm.createContext(ctx);
 for(const name of ['makeMenu','repairAsiloMenus','saveLibrary','uniqueId','mergeCloudPayload','applyCloudPayload','currentMenu','esc','parseDateOnly','isoWeekNumber','weekIndexForDate','isOcrDraftOpen','allergenLabels','parseCodes','allergenBox','validateAndNormalizeMenuJson','meal','sectionsOf','applyLibraryObject','libraryPayload']){
  const f=source.match(new RegExp('  function '+name+'\\([^]*?\\n  }'));
  assert(f, name); vm.runInContext(f[0],ctx);
 }
 return ctx;
}
test('16 October is winter week two; cycle changes on Monday across DST and year end',()=>{
 const c=context(),menu=presets[1];
 for(const [date,week] of [['2026-10-05',0],['2026-10-09',0],['2026-10-12',1],['2026-10-16',1],['2026-10-19',2],['2026-10-23',2],['2026-10-26',3],['2026-10-30',3],['2026-11-02',0],['2026-12-28',0],['2027-01-01',0],['2027-01-04',1]]){
  assert.equal(c.weekIndexForDate(menu,new Date(date+'T12:00:00')),week,date);
 }
 const day=menu.weeks[c.weekIndexForDate(menu,new Date('2026-10-16T12:00:00'))].days.venerdi;
 assert.equal(day.primo,'Risotto allo zafferano');assert.equal(day.secondo,'Filetto di platessa gratinato');
 assert.equal(day.primoA,'14');assert.equal(day.secondoA,'1,4');
});
test('all 40 meals match the printed ingredient-code columns',()=>{
 const expected=[
  [['1,14||15','1,8,16|3','1,7,15,16','1,15','14|1,4'],['14,15','1,14,15','14|3|15','1,14,15,16','1|1,4'],['1,8,16|14,15','14,15|1,4','1,7,15,16','1,14,15|1|15','1,15|3'],['1,14|1','1,8,16|14,15|15','14|7','1,15','1,15|1,4']],
  [['14,15|14,15','1|3','1,14,15','1,7,15,16','1,15|1,4'],['1,14,15|1','1,14,15,16','1|14,15','1,16|7,16','14|1,4'],['1,14,15|3','1','14,15|15','1,7,15,16','1|1,4'],['14,15|3','|14,15','1,15|14,15','1,16|7,16','14,16|1,4']]
 ];
 // Entries list first, second and side; absent columns are empty.
 for(let m=0;m<2;m++)for(let w=0;w<4;w++)for(let d=0;d<5;d++){
  const day=presets[m].weeks[w].days[['lunedi','martedi','mercoledi','giovedi','venerdi'][d]];
  const fields=expected[m][w][d].split('|');
  for(let i=0;i<3;i++)assert.equal(day[['primoA','secondoA','contornoA'][i]],fields[i]||'',`${m}/${w}/${d}/${i}`);
  assert.equal(day.fruttaA,'');
 }
});
test('nursery legend retains 15/16 and maps 14 to celery, independent of EU fallback',()=>{
 const c=context(); c.state.menus=clone(presets);c.state.activeId=presets[1].id;
 assert.match(c.allergenBox('14,15,16'),/14 · Sedano/);
 assert.match(c.allergenBox('14,15,16'),/15 · Pomodoro/);
 assert.match(c.allergenBox('14,15,16'),/16 · Formaggio/);
 assert.doesNotMatch(c.allergenBox('14'),/Molluschi/);
 assert.equal(c.parseCodes('1-7;15-16').join(','),'1,7,15,16');
});
test('migration is idempotent, preserves personal corrections and ignores unrelated menus',()=>{
 const c=context(),menus=clone(legacy);menus[1].weeks[1].days.venerdi.contorno='Mia correzione';
 const unrelated={id:'private',weeks:[],cycle:{mode:'single'}};menus.push(unrelated);
 assert.equal(c.repairAsiloMenus(menus),true);assert.equal(c.repairAsiloMenus(menus),false);
 assert.equal(menus[1].weeks[1].days.venerdi.contorno,'Mia correzione');
 assert.equal(menus[1].cycle.startDate,'2026-10-05');
 assert.equal(menus[0].weeks[0].days.lunedi.secondoA,'');assert.equal(menus[0].weeks[0].days.lunedi.contornoA,'15');
 assert.deepEqual(menus[2],unrelated);
});
test('backup roundtrip and cloud restore preserve cycle anchor, legend and active ID',()=>{
 const c=context();
 c.applyLibraryObject({menus:clone(presets),activeId:presets[1].id});
 assert.equal(c.state.activeId,presets[1].id);assert.equal(c.state.menus[1].allergenLabels[16],'Formaggio');
 assert.equal(c.state.menus[1].cycle.startDate,'2026-10-05');
 c.applyCloudPayload({menus:clone(legacy),activeId:presets[1].id});
 assert.equal(c.state.menus[1].allergenLabels[14],'Sedano');assert.equal(c.state.activeId,presets[1].id);
 const local={menus:clone(legacy),activeId:presets[1].id},remote={menus:clone(legacy),activeId:presets[1].id};
 assert.equal(c.mergeCloudPayload(local,remote).menus.length,2);
});
test('offline presets and published catalog agree',()=>{
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/menus.json'),'utf8')).menus,presets);
});
