const assert = require('node:assert/strict');
const fs = require('node:fs');
function load(file) {
  // CI already installs TypeScript. Node 24 can also run these pure helpers offline.
  try { return require('../' + file); } catch (error) {
    const ts = require('typescript');
    const module = {exports:{}};
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('module','exports',code)(module,module.exports);return module.exports;
  }
}
const {searchFoods}=load('src/lib/food-search.ts');
const foods=require('../src/data/ciqual-foods.json');
for(const query of ['pâtes','pates','PÂTES']) {
  const found=searchFoods(foods,query);
  assert.match(found[0].name,/Pâtes sèches, standard, cuites/);
  assert.match(found[1].name,/Pâtes sèches, standard, crues/);
  assert(!found.some(f=>/pâté|feuillet|brisée|sablée|courge/i.test(f.name)));
}
assert(searchFoods(foods,'pâte feuilletée').every(f=>/feuilletée/i.test(f.name)));
assert(searchFoods(foods,'pâté').every(f=>/pâté/i.test(f.name)));
assert(searchFoods(foods,'riz complet').every(f=>/complet/i.test(f.name)));
assert(searchFoods(foods,'patate douce').every(f=>/douce/i.test(f.name)));
assert(searchFoods(foods,'poulet cru').every(f=>/cru/i.test(f.name)));
assert.deepEqual(searchFoods(foods,'aliment introuvable xyz'),[]);
const fake=name=>({...foods[0],name,source:'evolve_community'});
assert(!searchFoods([fake('cerise'),fake('riz')],'riz').some(f=>f.name==='cerise'));
assert.equal(searchFoods([fake('Salade de pâtes au poulet'),...foods],'pates')[0].source,'ciqual_2025');
assert.equal(searchFoods([fake('Riz'),fake('Riz')],'riz').length,1);
const {photoMimeType,createFoodId,buildPhotoEntries}=load('src/lib/meal-photo.ts');
assert.equal(photoMimeType('/9j/abc'),'image/jpeg');
assert.equal(photoMimeType('iVBORw0KGgoAAA'),'image/png');
assert.equal(photoMimeType('UklGRabcd'),'image/webp');
assert.throws(()=>photoMimeType('HEIC'));
const food={localId:createFoodId(),name:'Pâtes cuites',estimated_grams:150,kcal_100g:130,protein_100g:5,carbs_100g:25,fat_100g:1,fiber_100g:2};
assert.match(food.localId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const rows=()=>buildPhotoEntries([food],'user','analysis','lunch','2026-10-03');
assert.equal(rows()[0].calories,195);assert.equal(rows()[0].protein_g,7.5);
assert.deepEqual(rows(),rows(),'Retries retain exactly the same row IDs and portions');
assert.equal(rows()[0].eaten_on,'2026-10-03');assert.equal(rows()[0].ai_analysis_id,'analysis');
for(const patch of [{estimated_grams:NaN},{estimated_grams:0},{estimated_grams:-1},{name:''},{fat_100g:101},{protein_100g:Infinity},{kcal_100g:-10}]) {
  assert.throws(()=>buildPhotoEntries([{...food,...patch}],'u','a','lunch','2026-10-03'));
}
console.log('Nutrition regression tests passed: search relevance, accents, qualifiers, cross-source ordering, MIME, portions, validation and stable retry IDs.');
