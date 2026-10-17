// Independent BigInt implementation of the documented integer-expression semantics.
const LIMIT=(1n<<127n)-1n,arity={abs:1,neg:1,add:2,sub:2,mul:2,div:2,mod:2,min:2,max:2,lt:2,le:2,eq:2,if:3};
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
function validate(expression){
 let count=0;
 const walk=(node,depth)=>{
  assert(++count<=64&&depth<=12,'Expression size');
  if(Number.isSafeInteger(node)&&Math.abs(node)<=1e12)return;
  if(node==='x'||node==='y')return;
  assert(Array.isArray(node)&&Object.hasOwn(arity,node[0])&&node.length===arity[node[0]]+1,'Expression grammar');
  for(const child of node.slice(1))walk(child,depth+1);
 };walk(expression,0);
}
function execute(expression,inputs){
 validate(expression);
 const result=x=>x>LIMIT||x< -LIMIT?{kind:'ERROR',code:'RANGE'}:{kind:'VALUE',value:x.toString()};
 const quotient=(a,b)=>{let q=a/b;return a%b!==0n&&(a<0n)!==(b<0n)?q-1n:q;};
 const ops={add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,div:quotient,mod:(a,b)=>a-b*quotient(a,b),min:(a,b)=>a<b?a:b,max:(a,b)=>a>b?a:b,lt:(a,b)=>BigInt(a<b),le:(a,b)=>BigInt(a<=b),eq:(a,b)=>BigInt(a===b)};
 const visit=node=>{
  if(typeof node==='number')return result(BigInt(node));
  if(typeof node==='string')return result(BigInt(inputs[node==='x'?0:1]));
  const op=node[0],left=visit(node[1]);if(left.kind==='ERROR')return left;
  const a=BigInt(left.value);
  if(op==='if')return visit(node[a===0n?3:2]);
  if(op==='neg')return result(-a);
  if(op==='abs')return result(a<0n?-a:a);
  const right=visit(node[2]);if(right.kind==='ERROR')return right;
  const b=BigInt(right.value);
  return (op==='div'||op==='mod')&&b===0n?{kind:'ERROR',code:'DIV_ZERO'}:result(ops[op](a,b));
 };return visit(expression);
}
function compare(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]<b[i]?-1:1;return 0;}
function replay(programs,pairs,incumbent,bounds){
 assert(Array.isArray(pairs)&&pairs.length<=8,'Proposal count');
 const seen=new Set();let improvement=null;
 const tested=pairs.map(pair=>{
  assert(Array.isArray(pair)&&pair.length===2&&pair.every(Number.isSafeInteger)&&pair[0]>=bounds[0]&&pair[0]<=bounds[1]&&pair[1]>=bounds[2]&&pair[1]<=bounds[3],'Proposal domain');
  const id=JSON.stringify(pair);assert(!seen.has(id),'Duplicate normalized proposal');seen.add(id);
  const reference=execute(programs[0].expression,pair),candidate=execute(programs[1].expression,pair),rank=[pair[0]+pair[1],...pair];
  const row={inputs:pair,reference,candidate,rank,diverges:JSON.stringify(reference)!==JSON.stringify(candidate)};
  if(row.diverges&&(!incumbent||compare(rank,incumbent.rank)<0)&&(!improvement||compare(rank,improvement.rank)<0))improvement=row;
  return row;
 });return {tested,improvement};
}
module.exports={execute,replay,compare};
if(require.main===module){
 let data='';process.stdin.on('data',x=>data+=x);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(data).map(({expression,inputs})=>execute(expression,inputs)))));
}
