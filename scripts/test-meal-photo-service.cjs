const assert=require('node:assert/strict');const fs=require('node:fs');
let source=fs.readFileSync('supabase/functions/analyze-meal-photo/index.ts','utf8').replace(/^import .*;\n/gm,'');
try { source=require('node:module').stripTypeScriptTypes(source); } catch { source=require('typescript').transpileModule(source,{compilerOptions:{target:99,module:1}}).outputText; }
async function call({key='test-only-key',token='user-token',body={imageBase64:'/9j/test',mimeType:'image/jpeg'},user=true,count=0,output,providerError,fetchError}={}){
 let handler, requestPayload, inserted;
 const client={auth:{getUser:async()=>({data:{user:user?{id:'user'}:null},error:null})},from:()=>({select:()=>({eq:()=>({gte:async()=>({count,error:null})})}),insert:row=>{inserted=row;return {select:()=>({single:async()=>({data:{id:'analysis-id'},error:null})})}}})};
 const Deno={env:{get:name=>name==='OPENAI_API_KEY'?key:'test'},serve:fn=>{handler=fn}};
 const fetch=async(_url,options)=>{requestPayload=JSON.parse(options.body);if(fetchError)throw fetchError;return new Response(JSON.stringify(providerError?{error:{code:'test'}}:{output:[{content:[{type:'output_text',text:JSON.stringify(output??{meal_summary:'Pâtes',confidence:'medium',foods:[{name:'Pâtes',estimated_grams:150,kcal_100g:130,protein_100g:5,carbs_100g:25,fat_100g:1,fiber_100g:2,confidence:0.6,assumptions:[]}],warnings:[]})}]}]}),{status:providerError?502:200})};
 new Function('Deno','createClient','fetch',source)(Deno,()=>client,fetch);
 const response=await handler(new Request('https://example.test',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:typeof body==='string'?body:JSON.stringify(body)}));
 return {status:response.status,data:await response.json(),requestPayload,inserted};
}
(async()=>{
 assert.equal((await call({token:''})).status,401);
 assert.equal((await call({user:false})).status,401);
 assert.equal((await call({key:null})).status,503);
 assert.equal((await call({body:'not-json'})).status,400);
 assert.equal((await call({body:{}})).status,400);
 assert.equal((await call({count:15})).status,429);
 assert.equal((await call({providerError:true})).status,502);
 assert.equal((await call({fetchError:new DOMException('timeout','TimeoutError')})).status,504);
 assert.equal((await call({output:{foods:[]}})).status,422);
 const legacy=await call();assert.equal(legacy.status,200);assert.equal(legacy.data.analysisId,'analysis-id');
 const modern=await call({body:{imageBase64:'/9j/test',mimeType:'image/jpeg',mealNotes:'150g cuits',mealType:'dinner'}});
 assert.equal(modern.status,200);assert.equal(modern.inserted.meal_type,'dinner');assert(!('imageBase64' in modern.inserted));
 assert(modern.requestPayload.input[1].content[0].text.includes('150g cuits'));
 assert.equal(modern.requestPayload.store,false);assert.equal(modern.requestPayload.text.format.schema.properties.foods.minItems,0);
 console.log('Meal photo service tests passed: legacy/new clients, authentication, missing activation, empty/invalid images, quota, provider failure, timeout, no-food result and metadata-only persistence.');
})().catch(e=>{console.error(e);process.exitCode=1});
