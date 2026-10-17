const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,sourceHash,save,invoke,read,rpc,receipt,delay}=require('./transport.cjs');
const {config,programs,checkState}=require('./proof-checks.cjs');
async function main(){
 assert(await rpc('eth_chainId',[])==='0xf22f','Gasless StudioNet only');
 const accounts=JSON.parse(process.env.FORGE_ACCOUNTS||'null');assert(accounts?.length===2,'Two public caller accounts');
 const revision=fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim();assert(/^[a-f0-9]{40}$/.test(revision),'Pinned source fixture revision');
 const deployments=[];
 for(const [name,c] of Object.entries(config)){
  const sources=programs(name,revision);
  for(const source of sources){const r=await fetch(source.url,{signal:AbortSignal.timeout(45000)});assert(r.ok&&Buffer.from(await r.arrayBuffer()).equals(Buffer.from(source.text)),'Published raw program bytes');}
  process.env.FORGE_ACCOUNT=accounts[0].name;
  const hash=await invoke(name+'-deployment',['deploy','--contract','contracts/counter_forge.py','--args',sources[0].url,sources[0].sha256,sources[1].url,sources[1].sha256,JSON.stringify(c.bounds),String(c.budget)]);
  const r=await receipt(name+'-deployment',hash,true),contract=r.to_address||r.recipient;
  assert(/^0x[a-f0-9]{40}$/i.test(contract),'Contract address');
  assert(fs.readFileSync(path.join(root,'contracts/counter_forge.py')).equals(Buffer.from(await rpc('gen_getContractCode',[contract]),'base64')),'Exact deployed contract');
  const d={name,contract,transaction:hash,reference:sources[0],candidate:sources[1],bounds:c.bounds,budget:c.budget,fixture_revision:revision,source_sha256:sourceHash,network:'studionet',chain_id:61999,callers:accounts.map(a=>a.address)};
  deployments.push(d);save('deployments',deployments);
  let state=await read(name+'-initial',['call',contract,'get_state']);checkState(state,d);assert(state.attempts===0,'Fresh comparison');save(name+'-initial-state',state);
  async function step(label,index,account,success=true,reason=null){
   process.env.FORGE_ACCOUNT=accounts[account].name;
   const before=state,tx=await invoke(label,['write',contract,'discover','--args',String(index)]),rr=await receipt(label,tx,success);
   state=await read(label+'-state',['call',contract,'get_state']);
   assert((rr.from_address||rr.sender).toLowerCase()===accounts[account].address,'Actual signer');
   if(success){checkState(state,d);assert(state.attempts===before.attempts+1&&state.records.at(-1).caller===accounts[account].address,'One attributed search');}
   else{
    assert(equal(before,state),'Rejected search changed state');
    const decoded=await read(label+'-decoded',['receipt',tx,'--status','FINALIZED','--retries','2']);
    assert(JSON.stringify(decoded).includes(reason),'Exact error reason');save(label+'-decoded-receipt',decoded);
   }
   save(label,{contract,transaction:tx,sender:accounts[account].address,success,reason,method:'discover',index,state_before:before,state});
  }
  for(let i=0;i<c.budget;i++){
   await step(name+'-search-'+i,i,i%2);
   if(name==='a'&&i===0){assert(state.best,'First cap-comparison witness');await step('stale-search',0,1,false,'[EXPECTED] Search attempt does not match');}
  }
  assert(!!state.best===!!c.witness,'Expected witness/no-witness case');
  assert(state.status.startsWith('EXHAUSTED')||state.status==='MINIMAL_WITNESS','Terminal proof');
  if(name==='a'||name==='b')await step(name+'-terminal',c.budget,1,false,'[EXPECTED] Search is terminal');
  save(name+'-final-state',state);console.log('VERIFIED',name,contract,state.status);await delay(4000);
 }
}
main().catch(e=>{console.error(e.stack,e.cause?.message||'');process.exitCode=1;});
