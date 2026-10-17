const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest}=require('./transport.cjs');
const {replay}=require('./integer-oracle.cjs');
const config=JSON.parse(fs.readFileSync(path.join(root,'config/scenarios.json'))),publisher='mahdidaawsh-commits/counter-forge';
function programs(name,revision){
 const c=config[name];return ['reference_file','candidate_file'].map(k=>{
  const body=fs.readFileSync(path.join(root,'programs',c[k])),decoded=JSON.parse(body);
  assert(equal(Object.keys(decoded).sort(),['expression','format'])&&decoded.format==='CounterForge-v1','Source language');
  return {url:`https://raw.githubusercontent.com/${publisher}/${revision}/programs/${c[k]}`,sha256:digest(body),text:body.toString('utf8'),expression:decoded.expression};
 });
}
function phase(best,attempts,budget,bounds){
 return best&&equal(best.inputs,[bounds[0],bounds[2]])?'MINIMAL_WITNESS':(attempts>=budget?'EXHAUSTED_':'SEARCHING_')+(best?'WITH_WITNESS':'NO_WITNESS');
}
function checkState(state,d){
 const c=config[d.name],sources=programs(d.name,d.fixture_revision);
 assert(equal(Object.keys(state).sort(),['reference_url','reference_hash','candidate_url','candidate_hash','bounds','budget','attempts','status','sources','best','records'].sort()),'Exact state shape');
 assert(state.reference_url===sources[0].url&&state.reference_hash===sources[0].sha256&&state.candidate_url===sources[1].url&&state.candidate_hash===sources[1].sha256&&equal(state.bounds,c.bounds)&&state.budget===c.budget,'Frozen source/domain/budget');
 assert(equal(d.reference,sources[0])&&equal(d.candidate,sources[1])&&equal(d.bounds,c.bounds)&&d.budget===c.budget,'Deployment/source binding');
 assert(Number.isInteger(state.attempts)&&state.attempts>=0&&state.attempts<=c.budget&&state.records.length===state.attempts,'Bounded attempt history');
 assert(equal(state.sources,state.attempts?sources:null),'Exact full source bundle');
 let incumbent=null;
 for(let i=0;i<state.attempts;i++){
  const row=state.records[i];
  assert(equal(Object.keys(row).sort(),['attempt','caller','tested','verdict','improvement','incumbent'].sort())&&row.attempt===i&&d.callers.includes(row.caller),'Actual attempt metadata');
  assert(!phase(incumbent,i,c.budget,c.bounds).startsWith('EXHAUSTED')&&phase(incumbent,i,c.budget,c.bounds)!=='MINIMAL_WITNESS','No records after terminal state');
  const replayed=replay(sources,row.tested.map(t=>t.inputs),incumbent,c.bounds);
  assert(equal(row.tested,replayed.tested)&&equal(row.improvement,replayed.improvement),'Independent BigInt witness executions');
  assert(row.verdict===(replayed.improvement?'IMPROVED':'NO_VERIFIED_IMPROVEMENT'),'Exact improvement decision');
  if(replayed.improvement)incumbent=replayed.improvement;
  assert(equal(row.incumbent,incumbent),'Monotone best witness');
 }
 assert(equal(state.best,incumbent)&&state.status===phase(incumbent,state.attempts,c.budget,c.bounds),'Exact final phase and witness');
 return true;
}
module.exports={config,publisher,programs,phase,checkState};
