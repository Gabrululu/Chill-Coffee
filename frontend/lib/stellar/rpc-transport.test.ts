import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestnetRpcTransport, TESTNET_RPC_URLS } from './rpc-transport';
import { TESTNET } from './config';
const network = {passphrase:TESTNET.passphrase,protocolVersion:29};
const reply = (result: unknown) => Response.json({jsonrpc:'2.0',id:1,result});
const request = {jsonrpc:'2.0',id:1,method:'getLatestLedger'};
test('a failed SDF route switches to verified Testnet and keeps the working endpoint', async () => {
  const calls: string[]=[];
  const transport = createTestnetRpcTransport(async (url,init) => {
    calls.push(String(url));
    if(url===TESTNET_RPC_URLS[0]) return new Response('no available server',{status:503});
    return reply(JSON.parse(init!.body as string).method==='getNetwork'?network:{sequence:123});
  });
  assert.deepEqual((await transport.request(request)).result,{sequence:123});
  assert.equal(transport.endpoint(),TESTNET_RPC_URLS[1]);
  await transport.request(request);assert.equal(calls.filter(url=>url===TESTNET_RPC_URLS[0]).length,1);
});
test('Mainnet or unsupported protocol endpoints can never receive a transaction', async () => {
  for(const bad of [{passphrase:'Public Global Stellar Network ; September 2015',protocolVersion:29},{...network,protocolVersion:28}]){
    let sends=0;
    const transport=createTestnetRpcTransport(async (_url,init)=>{
      const body=JSON.parse(init!.body as string);if(body.method==='sendTransaction') sends++;
      return reply(bad);
    });
    await assert.rejects(transport.request({...request,method:'sendTransaction',params:{transaction:'signed'}}),/did not confirm/);
    assert.equal(sends,0);
  }
});
test('an interrupted send is attempted exactly once and never fails over or resubmits', async () => {
  let sends=0;const endpoints:string[]=[];
  const transport=createTestnetRpcTransport(async (url,init)=>{
    const body=JSON.parse(init!.body as string);
    if(body.method==='getNetwork')return reply(network);
    sends++;endpoints.push(String(url));throw new TypeError('lost send response');
  });
  await assert.rejects(transport.request({...request,method:'sendTransaction',params:{transaction:'signed'}}),/lost send response/);
  assert.equal(sends,1);assert.deepEqual(endpoints,[TESTNET_RPC_URLS[0]]);
});
test('a failed read retries on the other verified endpoint; contract errors are preserved', async () => {
  const transport=createTestnetRpcTransport(async (url,init)=>{
    const body=JSON.parse(init!.body as string);if(body.method==='getNetwork')return reply(network);
    if(url===TESTNET_RPC_URLS[0])throw new TypeError('offline');
    return Response.json({jsonrpc:'2.0',id:1,error:{code:-32602,message:'Invalid argument'}});
  });
  assert.deepEqual((await transport.request(request)).error,{code:-32602,message:'Invalid argument'});
});
test('verification is single-flight for concurrent reads; invalid responses never count as healthy', async () => {
  let probes=0;
  const transport=createTestnetRpcTransport(async (_url,init)=>{
    const body=JSON.parse(init!.body as string);if(body.method==='getNetwork'){probes++;await new Promise(resolve=>setImmediate(resolve));return reply(network);}return reply({sequence:1});
  });
  await Promise.all([transport.request(request),transport.request(request)]);assert.equal(probes,1);
  const invalid=createTestnetRpcTransport(async()=>Response.json({jsonrpc:'2.0',id:999,result:network}));
  await assert.rejects(invalid.request(request),/invalid response/);
});

test('redirects are rejected without forwarding signed transactions in Workers', async () => {
  let sends = 0;
  const transport = createTestnetRpcTransport(async (_url, init) => {
    assert.equal(init?.redirect, 'manual');
    const body = JSON.parse(init!.body as string);
    if (body.method === 'getNetwork') return reply(network);
    sends++;
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/' } });
  });
  await assert.rejects(transport.request({ ...request, method: 'sendTransaction', params: { transaction: 'signed' } }), /HTTP 302/);
  assert.equal(sends, 1);
});
