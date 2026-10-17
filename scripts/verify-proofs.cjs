const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest,rpc,read,receiptSummary,save}=require('./transport.cjs');
const {config,checkState}=require('./proof-checks.cjs');
const load=n=>JSON.parse(fs.readFileSync(path.join(root,'proofs',n+'.json')));
async function main(){
 const offline=process.argv.includes('--offline'),deployments=load('deployments'),code=fs.readFileSync(path.join(root,'contracts/counter_forge.py')),journal=load('transactions');
 assert(equal(deployments.map(d=>d.name),Object.keys(config)),'All four comparisons');assert(journal.source_sha256===digest(code),'Journal contract binding');
 if(!offline)assert(await rpc('eth_chainId',[])==='0xf22f','StudioNet only');
 const hashes=new Set(),summary={mode:offline?'offline-artifact':'fresh-rpc-and-state',source_sha256:digest(code),contracts:[],transactions:[]};
 async function verify(label,hash,d,success,sender){
  assert(!hashes.has(hash)&&journal.hashes[label]===hash,'Unique journal-bound transaction');hashes.add(hash);
  const saved=load(label+'-receipt'),r=offline?saved:await rpc('eth_getTransactionByHash',[hash]),s=receiptSummary(r);
  assert(s.hash===hash&&s.status==='FINALIZED'&&s.result==='MAJORITY_AGREE'&&s.agree>(s.agree+s.disagree+s.idle)/2,'Finalized strict majority');
  assert((r.to_address||r.recipient).toLowerCase()===d.contract.toLowerCase()&&(r.from_address||r.sender).toLowerCase()===sender,'Actual contract and sender');
  assert(equal(saved.consensus_data.votes,r.consensus_data.votes),'Saved raw votes');
  assert(success?['SUCCESS','FINISHED_WITH_RETURN'].includes(s.execution):s.execution==='ERROR','Execution outcome');summary.transactions.push({label,...s});
 }
 for(const d of deployments){
  assert(d.network==='studionet'&&d.chain_id===61999&&d.source_sha256===digest(code),'Deployment domain');
  assert(d.fixture_revision===fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim(),'Pinned program fixtures');
  assert(d.callers.length===2&&new Set(d.callers).size===2,'Distinct callers');
  await verify(d.name+'-deployment',d.transaction,d,true,d.callers[0]);
  let previous=load(d.name+'-initial-state');checkState(previous,d);assert(previous.attempts===0,'Fresh initial state');
  const calls=[];
  for(let i=0;i<config[d.name].budget;i++){
   calls.push([d.name+'-search-'+i,i,i%2,true,null]);
   if(d.name==='a'&&i===0)calls.push(['stale-search',0,1,false,'[EXPECTED] Search attempt does not match']);
  }
  if(d.name==='a'||d.name==='b')calls.push([d.name+'-terminal',config[d.name].budget,1,false,'[EXPECTED] Search is terminal']);
  for(const [label,index,caller,success,reason] of calls){
   const p=load(label);assert(p.contract===d.contract&&p.method==='discover'&&p.index===index&&p.sender===d.callers[caller]&&p.success===success&&p.reason===reason&&equal(p.state_before,previous),'Exact call and snapshot chain');
   await verify(label,p.transaction,d,success,p.sender);
   if(success){checkState(p.state,d);assert(p.state.attempts===previous.attempts+1&&p.state.records.at(-1).caller===p.sender,'Actual attributed search');}
   else assert(equal(previous,p.state)&&JSON.stringify(load(label+'-decoded-receipt')).includes(reason),'Unchanged state and exact rejection');
   previous=p.state;
  }
  assert(!!previous.best===!!config[d.name].witness&&equal(previous,load(d.name+'-final-state')),'Final witness expectation');
  assert(previous.status.startsWith('EXHAUSTED')||previous.status==='MINIMAL_WITNESS','Terminal state');
  if(!offline){
   assert(code.equals(Buffer.from(await rpc('gen_getContractCode',[d.contract]),'base64')),'Exact live contract bytes');
   assert(equal(previous,await read(d.name+'-fresh',['call',d.contract,'get_state'])),'Fresh final state');
  }
  summary.contracts.push({name:d.name,contract:d.contract,status:previous.status,attempts:previous.attempts,best:previous.best});
 }
 assert(hashes.size===13&&Object.keys(journal.hashes).length===13,'Complete thirteen transaction proof set');
 if(!offline){summary.live_state_match=true;save('verification',summary);}
 console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
