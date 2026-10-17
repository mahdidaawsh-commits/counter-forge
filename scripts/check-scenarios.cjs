const {assert}=require('./transport.cjs');
const {config,programs,checkState,phase}=require('./proof-checks.cjs');
const {replay}=require('./integer-oracle.cjs');
for(const [name,c] of Object.entries(config)){
 const sources=programs(name,'a'.repeat(40)),d={name,fixture_revision:'a'.repeat(40),reference:sources[0],candidate:sources[1],bounds:c.bounds,budget:c.budget,callers:['0x'+'1'.repeat(40),'0x'+'2'.repeat(40)]};
 const state={reference_url:sources[0].url,reference_hash:sources[0].sha256,candidate_url:sources[1].url,candidate_hash:sources[1].sha256,bounds:c.bounds,budget:c.budget,attempts:0,status:'SEARCHING_NO_WITNESS',sources:null,best:null,records:[]};
 checkState(state,d);
 for(let i=0;i<c.budget;i++){
  const result=replay(sources,c.witness?[c.witness]:[],state.best,c.bounds);state.sources=sources;
  if(result.improvement)state.best=result.improvement;
  state.records.push({attempt:i,caller:d.callers[i%2],tested:result.tested,verdict:result.improvement?'IMPROVED':'NO_VERIFIED_IMPROVEMENT',improvement:result.improvement,incumbent:state.best});
  state.attempts++;state.status=phase(state.best,state.attempts,state.budget,state.bounds);checkState(state,d);
 }
 assert(!!state.best===!!c.witness,'Expected counterexample case');
}
console.log('Independent verifier accepts four complete synthetic notebook traces');
