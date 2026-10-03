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

const {portionGrams, defaultUnitGrams, portionNumber, portionEntryName} = load('src/lib/food-portions.ts');
assert.equal(portionGrams('2','unit','50','1'),100);
assert.equal(portionGrams('0,5','unit','50','1'),25);
assert.equal(portionGrams('200','ml','','1'),200);
assert.equal(portionGrams('100','ml','','0,92'),92);
assert.equal(portionGrams('150','g','',''),150);
for(const amount of ['', '-1', 'Infinity', 'NaN', '1e3', '1.2.3', '0', '10001']) assert.equal(portionGrams(amount,'g','','1'),null);
assert.equal(portionGrams('2','unit','','1'),null);
assert.equal(portionGrams('2','unit','-20','1'),null);
assert.equal(portionGrams('200','ml','',''),null);
assert.equal(defaultUnitGrams('Oeuf dur'),50);
assert.equal(defaultUnitGrams("Oeuf, blanc (blanc d'oeuf), cuit"),30);
assert.equal(defaultUnitGrams("Oeuf, jaune (jaune d'oeuf), cru"),18);
for(const name of ['Pâtes aux oeufs', 'Oeuf de caille, cru', 'Oeuf au jambon en gelée', 'Oeuf, blanc (blanc d\'oeuf), en poudre', 'Oeufs de saumon']) assert.equal(defaultUnitGrams(name),null);
assert.equal(defaultUnitGrams('Yaourt',125),125);
assert.equal(portionEntryName('Œuf dur','2','unit'),'Œuf dur (2 unité(s))');
console.log('Portion tests passed: eggs, fractions, ml density, invalid inputs and legacy gram storage.');

(async () => {
  const {searchOpenFoodFactsProducts} = load('src/lib/open-food-facts-search.ts');
  const originalFetch = global.fetch;
  try {
    let requested;
    global.fetch = async (url) => {
      requested = new URL(url);
      return {ok:true,json:async()=>({products:[
        {code:'1',product_name_fr:'Skyr nature',brands:'Marque',serving_quantity:125,serving_quantity_unit:'g',nutriments:{'energy-kcal_100g':60,proteins_100g:10,carbohydrates_100g:null}},
        {code:'2',product_name_fr:'Produit sans données',nutriments:{}},
        {code:'3',product_name_fr:'Lait',serving_quantity:200,serving_quantity_unit:'ml',nutriments:{'energy-kcal_100g':45}},
        {code:'1',product_name_fr:'Doublon',nutriments:{proteins_100g:10}}
      ]})};
    };
    const products = await searchOpenFoodFactsProducts('skyr',50,undefined,2);
    assert.equal(requested.searchParams.get('page'),'2');
    assert.equal(requested.searchParams.get('page_size'),'50');
    assert.equal(products.length,2);
    assert.equal(products[0].carbs100,null,'Missing carbohydrates must not become zero');
    assert.equal(products[0].servingGrams,125);
    assert.equal(products[1].servingGrams,null,'A volume serving must not be treated as a gram weight');
    global.fetch = async () => ({ok:false});
    await assert.rejects(()=>searchOpenFoodFactsProducts('riz',50));
    console.log('Extended catalogue tests passed: pagination, serving units, missing nutrients, duplicates and provider failure.');
  } finally { global.fetch = originalFetch; }
})().catch(error => { console.error(error); process.exitCode=1; });
