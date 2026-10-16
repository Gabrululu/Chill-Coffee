import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCafeItem, validateRecipe } from './generate-item';
const recipe={name:'Andean Moon Matcha',category:'coffee',ingredients:['Matcha'],description:'A warm cup',vibe:'Cozy',price_xlm:3};
test('rejects untrusted AI data',()=>{for(const input of [null,{}, {name:'a'.repeat(61)}, {name:'a',vibe:'b',description:'c',category:'coffee',price_xlm:-1,ingredients:['a']}]) assert.throws(()=>validateRecipe(input));});
test('rejects invalid categories, oversized ingredients, and nonfinite prices',()=>{
 const valid={name:'Orbit',category:'coffee',description:'A warm cup',vibe:'Cozy',ingredients:['Espresso'],price_xlm:2};
 for(const patch of [{category:'invalid'},{ingredients:['a'.repeat(61)]},{ingredients:[]},{ingredients:Array(9).fill('Coffee')},{price_xlm:NaN},{price_xlm:6},{description:'x'.repeat(241)},{vibe:''}])assert.throws(()=>validateRecipe({...valid,...patch}));
});
test('rejects empty and oversized prompts',async()=>{await assert.rejects(generateCafeItem(''));await assert.rejects(generateCafeItem('x'.repeat(601)));});

test('validates byte limits, strips untrusted fields, and rejects excess precision', () => {
 const valid={name:'Orbit',category:'coffee',description:'A warm cup',vibe:'Cozy',ingredients:['Espresso'],price_xlm:2};
 assert.equal('creator' in validateRecipe({...valid,creator:'attacker'}),false);
 for(const patch of [{name:'é'.repeat(31)},{description:'é'.repeat(121)},{vibe:'space\ncoffee'},{ingredients:['a\u0000b']},{price_xlm:1.12345678},{price_xlm:'3'}]) assert.throws(()=>validateRecipe({...valid,...patch}));
});
test('client sends only the prompt and validates the route response', async () => {
 const original=globalThis.fetch;
 try {
   globalThis.fetch=async (url,options)=>{assert.equal(url,'/api/barista');assert.deepEqual(JSON.parse(options!.body as string),{prompt:'matcha'}); return Response.json({recipe:recipe});};
   assert.equal((await generateCafeItem('matcha')).name,'Andean Moon Matcha');
   globalThis.fetch=async()=>Response.json({recipe:{name:'broken'}});
   await assert.rejects(generateCafeItem('matcha'));
   globalThis.fetch=async()=>Response.json({error:'Try again shortly.'},{status:429});
   await assert.rejects(generateCafeItem('matcha'),/Try again shortly/);
 } finally {globalThis.fetch=original;}
});
test('client sends the selected dessert category and refuses an inconsistent generated recipe', async () => {
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async (_,options)=>{assert.deepEqual(JSON.parse(options!.body as string),{prompt:'cake',category:'dessert'});return Response.json({recipe:{...recipe,category:'dessert'}});};
  assert.equal((await generateCafeItem('cake',undefined,'dessert')).category,'dessert');
  globalThis.fetch=async()=>Response.json({recipe});
  await assert.rejects(generateCafeItem('cake',undefined,'dessert'),/does not match/);
 } finally {globalThis.fetch=original;}
});
