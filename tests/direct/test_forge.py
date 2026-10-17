import ast
import hashlib
import itertools
import json
import random
import re
import subprocess
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]
CONFIG=json.loads((ROOT/'config/scenarios.json').read_text())
BASE='https://raw.githubusercontent.com/mahdidaawsh-commits/counter-forge/'+'a'*40+'/programs/'


def files(name):
    c=CONFIG[name]
    return [(ROOT/'programs'/c[k]).read_bytes() for k in ('reference_file','candidate_file')]


def args(name):
    c=CONFIG[name]
    bodies=files(name)
    return [BASE+c['reference_file'],hashlib.sha256(bodies[0]).hexdigest(),BASE+c['candidate_file'],hashlib.sha256(bodies[1]).hexdigest(),c['bounds'],c['budget']]


@pytest.fixture
def deploy(direct_deploy):
    return lambda name='a',custom=None: direct_deploy(str(ROOT/'contracts/counter_forge.py'),*(custom or args(name)))


def mock_web(vm,name='a',bodies=None,status=200):
    c=CONFIG[name]
    for file,body in zip((c['reference_file'],c['candidate_file']),bodies or files(name)):
        vm.mock_web(re.escape(BASE+file),{'status':status,'body':body})


def mock(vm,name='a',pairs=None,raw=None):
    vm.clear_mocks()
    mock_web(vm,name)
    vm.mock_llm('.*COUNTERFORGE-SEARCH.*',raw if raw is not None else json.dumps({'candidates':pairs if pairs is not None else [CONFIG[name]['witness']] if CONFIG[name]['witness'] else []}))


@pytest.mark.parametrize('name',['a','b','c','d'])
def test_live_mechanism_with_validator_replay(deploy,direct_vm,direct_alice,direct_bob,name):
    c=deploy(name)
    mock(direct_vm,name)
    direct_vm.sender=direct_alice
    c.discover(0)
    assert direct_vm.run_validator() is True
    s=c.get_state()
    assert s['attempts']==1 and len(s['records'])==1
    assert s['records'][0]['caller']=='0x'+direct_alice.hex()
    assert bool(s['best'])==bool(CONFIG[name]['witness'])
    for source,body in zip(s['sources'],files(name)):
        assert source['text']==body.decode() and source['sha256']==hashlib.sha256(body).hexdigest()
    if name=='a':
        assert s['best']['reference']=={'kind':'VALUE','value':'1000000'}
        assert s['best']['candidate']=={'kind':'VALUE','value':'1000001'}
    if name=='b':
        assert s['best']['candidate']=={'kind':'ERROR','code':'DIV_ZERO'} and s['status']=='MINIMAL_WITNESS'
    if name=='c':
        assert s['best']['reference']['value']=='1' and s['best']['candidate']['value']=='0'
    if name=='d':
        direct_vm.sender=direct_bob
        mock(direct_vm,name)
        c.discover(1)
        assert direct_vm.run_validator() is True
        assert c.get_state()['status']=='EXHAUSTED_NO_WITNESS' and c.get_state()['best'] is None


def test_strict_rank_improvement_preserves_history(deploy,direct_vm):
    c=deploy()
    mock(direct_vm,pairs=[[1000000,1000000]])
    c.discover(0)
    before=c.get_state()
    mock(direct_vm,pairs=[[1,1000000],[0,1000000],[1,1000000]])
    c.discover(1)
    assert direct_vm.run_validator() is True
    s=c.get_state()
    assert s['best']['rank']<before['best']['rank'] and s['best']['inputs']==[1,1000000]
    assert s['records'][0]==before['records'][0] and len(s['records'][1]['tested'])==2
    assert s['status']=='EXHAUSTED_WITH_WITNESS'


def test_nonimprovement_consumes_budget_without_erasing_incumbent(deploy,direct_vm):
    c=deploy()
    mock(direct_vm)
    c.discover(0)
    previous=c.get_state()['best']
    mock(direct_vm,pairs=[[0,0],[1000000,1]])
    c.discover(1)
    assert direct_vm.run_validator() is True
    s=c.get_state()
    assert s['best']==previous and s['records'][1]['verdict']=='NO_VERIFIED_IMPROVEMENT'


def test_valid_witness_requires_no_validator_model_answer(deploy,direct_vm):
    c=deploy()
    mock(direct_vm)
    c.discover(0)
    direct_vm.clear_mocks()
    mock_web(direct_vm)
    assert direct_vm.run_validator() is True


def test_validator_own_counterexample_rejects_leader_miss(deploy,direct_vm):
    c=deploy()
    mock(direct_vm,pairs=[])
    c.discover(0)
    mock(direct_vm,pairs=[[1,1000000]])
    assert direct_vm.run_validator() is False


def test_validator_refetches_actual_programs(deploy,direct_vm):
    c=deploy()
    mock(direct_vm)
    c.discover(0)
    direct_vm.clear_mocks()
    mock_web(direct_vm,bodies=[b'Changed committed source bytes cannot be accepted.',files('a')[1]])
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize('index',[True,-1,1])
def test_bad_attempt_rejected_before_nondeterminism(deploy,direct_vm,index):
    c=deploy()
    before=c.get_state()
    with direct_vm.expect_revert('Search attempt does not match'): c.discover(index)
    assert c.get_state()==before


def test_stale_attempt_cannot_spend_next_search(deploy,direct_vm):
    c=deploy()
    mock(direct_vm)
    c.discover(0)
    before=c.get_state()
    with direct_vm.expect_revert('Search attempt does not match'): c.discover(0)
    assert c.get_state()==before


@pytest.mark.parametrize('name',['a','b','c','d'])
def test_terminal_states_absorb_calls(deploy,direct_vm,name):
    c=deploy(name)
    for i in range(CONFIG[name]['budget']):
        mock(direct_vm,name)
        c.discover(i)
    before=c.get_state()
    with direct_vm.expect_revert('Search is terminal'): c.discover(CONFIG[name]['budget'])
    assert before==c.get_state()


@pytest.mark.parametrize('raw',[
    '{}','{"candidates":[[true,0]]}','{"candidates":[[0]]}',
    '{"candidates":[[-1,0]]}','{"candidates":[[1000001,0]]}',
    '{"candidates":[[0.5,0]]}','{"candidates":null}',
    '{"candidates":[],"equivalent":true}',
    json.dumps({'candidates':[[0,0]]*9})])
def test_invalid_model_proposals_cannot_spend_budget(deploy,direct_vm,raw):
    c=deploy()
    mock(direct_vm,raw=raw)
    with direct_vm.expect_revert(): c.discover(0)
    assert c.get_state()['attempts']==0 and c.get_state()['sources'] is None


@pytest.mark.parametrize('status',[404,503])
def test_external_error_does_not_consume_search(deploy,direct_vm,status):
    c=deploy()
    direct_vm.clear_mocks()
    mock_web(direct_vm,status=status)
    with direct_vm.expect_revert('Program'): c.discover(0)
    assert c.get_state()['attempts']==0


def test_hash_mismatch_cannot_bind_different_code(deploy,direct_vm):
    c=deploy()
    direct_vm.clear_mocks()
    mock_web(direct_vm,bodies=[b'Unexpected source content '*3,files('a')[1]])
    with direct_vm.expect_revert('Committed program hash mismatch'): c.discover(0)
    assert c.get_state()['sources'] is None


@pytest.fixture
def pure():
    tree=ast.parse((ROOT/'contracts/counter_forge.py').read_text())
    functions=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in ('parsed','validate_expression','execute','checked_inputs','replay')]
    namespace={'json':json,'LIMIT':(1<<127)-1,'ARITY':{'abs':1,'neg':1,'add':2,'sub':2,'mul':2,'div':2,'mod':2,'min':2,'max':2,'lt':2,'le':2,'eq':2,'if':3},'fail':lambda msg:(_ for _ in ()).throw(ValueError(msg))}
    exec(compile(ast.Module(body=functions,type_ignores=[]),'<contract algorithms>','exec'),namespace)
    return namespace


@pytest.mark.parametrize('expression,inputs,expected',[
    (['div',['neg','x'],'y'],[5,2],{'kind':'VALUE','value':'-3'}),
    (['mod',['neg','x'],'y'],[5,2],{'kind':'VALUE','value':'1'}),
    (['if',0,['div',1,0],7],[0,0],{'kind':'VALUE','value':'7'}),
    (['if',-1,9,['div',1,0]],[0,0],{'kind':'VALUE','value':'9'}),
    (['div',1,0],[0,0],{'kind':'ERROR','code':'DIV_ZERO'}),
    (['mul',['mul',10**12,10**12],['mul',10**12,10**12]],[0,0],{'kind':'ERROR','code':'RANGE'}),
    (['div',['mul',['mul',10**12,10**12],['mul',10**12,10**12]],0],[0,0],{'kind':'ERROR','code':'RANGE'})])
def test_integer_semantics_and_fault_precedence(pure,expression,inputs,expected):
    pure['validate_expression'](expression)
    assert pure['execute'](expression,inputs)==expected


def test_all_1681_signed_division_and_remainder_pairs(pure):
    for a,b in itertools.product(range(-20,21),repeat=2):
        for op in ('div','mod'):
            result=pure['execute']([op,a,b],[0,0])
            assert result==({'kind':'ERROR','code':'DIV_ZERO'} if not b else {'kind':'VALUE','value':str(a//b if op=='div' else a%b)})


def test_identical_errors_do_not_form_counterexamples(pure):
    rows,best=pure['replay']([{'expression':['div',1,0]},{'expression':['mod',2,0]}],[[0,0]],None)
    assert best is None and rows[0]['diverges'] is False


@pytest.mark.parametrize('expression',[True,1.5,10**12+1,'z',['add',1],['eval','x'],['if',1,2,3,4],{'code':'x'}])
def test_program_grammar_rejects_unsupported_constructs(pure,expression):
    with pytest.raises(ValueError): pure['validate_expression'](expression)


def test_structure_budget_is_bounded(pure):
    deep=0
    for _ in range(14): deep=['neg',deep]
    with pytest.raises(ValueError,match='structure limit'): pure['validate_expression'](deep)
    wide=0
    for _ in range(6): wide=['add',wide,wide]
    with pytest.raises(ValueError,match='structure limit'): pure['validate_expression'](wide)


def test_duplicate_raw_json_keys_are_rejected(pure):
    with pytest.raises(ValueError,match='JSON'):
        pure['checked_inputs']('{"candidates":[],"candidates":[]}',[0,1,0,1])


@pytest.mark.parametrize('body',[
    b'{"format":"CounterForge-v1","expression":"x","expression":"y"}',
    b'{"format":"CounterForge-v1","expression":true}',
    b'{"format":"CounterForge-v1","expression":["eval","x"]}',
    b'{"format":"CounterForge-v1","expression":"x","trusted":true}',
    b'{"format":"OtherLanguage","expression":"x"}'
])
def test_committed_but_invalid_program_cannot_consume_budget(deploy,direct_vm,body):
    values=args('a')
    values[1]=hashlib.sha256(body).hexdigest()
    c=deploy(custom=values)
    direct_vm.clear_mocks()
    mock_web(direct_vm,bodies=[body,files('a')[1]])
    with direct_vm.expect_revert('[EXTERNAL]'): c.discover(0)
    assert c.get_state()['sources'] is None and c.get_state()['attempts']==0


def test_python_and_independent_bigint_interpreter_agree(pure):
    rng=random.Random(1765)
    binary=['add','sub','mul','div','mod','min','max','lt','le','eq']
    def generate(depth):
        if not depth or rng.randrange(4)==0:return rng.choice(['x','y',rng.randrange(-10,11)])
        op=rng.choice(binary+['abs','neg','if'])
        return [op,*[generate(depth-1) for _ in range(3 if op=='if' else 1 if op in ('abs','neg') else 2)]]
    batch=[{'expression':generate(3),'inputs':[rng.randrange(11),rng.randrange(11)]} for _ in range(512)]
    batch.append({'expression':['mul',['mul',10**12,10**12],['mul',10**12,10**12]],'inputs':[0,0]})
    expected=[pure['execute'](r['expression'],r['inputs']) for r in batch]
    output=subprocess.run(['node',str(ROOT/'scripts/integer-oracle.cjs')],input=json.dumps(batch),text=True,capture_output=True,check=True)
    assert json.loads(output.stdout)==expected


@pytest.mark.parametrize('index,value',[(0,'https://example.org/code.json'),(0,BASE.replace('a'*40,'main')+'spec-a.json'),(1,'bad'),(4,[0,1]),(4,[True,10,0,1]),(4,[10,0,0,1]),(4,[0,10**9+1,0,1]),(5,0),(5,9),(5,True)])
def test_invalid_constructor_rejected(deploy,direct_vm,index,value):
    values=args('a')
    values[index]=value
    with direct_vm.expect_revert(): deploy(custom=values)
