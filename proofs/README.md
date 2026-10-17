# Onchain proofs

Four gasless StudioNet comparisons (chain **61999**) completed their fixed search budgets. All **13 transactions** are `FINALIZED` with `MAJORITY_AGREE` and strict recorded-vote majorities: **four deployments, six successful searches and three intentional rejections**. Votes are 3 agree / 2 idle except the A terminal rejection, which has 5 agree. Raw receipts retain the complete vote maps; no dissent was recorded in this set.

## Actual search results

These are the model-generated witnesses saved by the deployed contracts, independently replayed with the separate BigInt interpreter. Known test witnesses were not supplied to the deployed constructor or prompt. Source inputs and interpreter limits are described in the [readable examples](../docs/examples.md) and [language specification](../docs/architecture.md).

| Pair | Contract | Deployment | Search transaction | Verified result |
| --- | --- | --- | --- | --- |
| A: joint cap versus separate caps | `0x9701B7C4C32E583d03c08B92C19209798C6A9577` | [Deploy](https://explorer-studio.genlayer.com/tx/0x3deb51ea858c02356f45df624bf869ce4ac05bc2f385d99e51d291e730866b6c) | [Find witness](https://explorer-studio.genlayer.com/tx/0x33b4f74bea0adb5b271ee44e42482c0431aaddd1b7c4e54ef4a691181abadb5e), [improvement search](https://explorer-studio.genlayer.com/tx/0xd4ef10181db8a9c59fb1dfcadaba814e86be69fe81ff04f50dfb1a9239ff98ed) | `(1,1000000)` gives **1000000 versus 1000001**; second search preserves the incumbent; EXHAUSTED_WITH_WITNESS |
| B: missing zero guard | `0xaE103447b7e9C29c07d3F67140Ac44D03F1590fd` | [Deploy](https://explorer-studio.genlayer.com/tx/0xe005f5ee8fe0e3a9e5f3d94a72e5c17b6768dd1641153a13c4460e7663fd07f8) | [Find witness](https://explorer-studio.genlayer.com/tx/0x1719dca70f4022fe18800222a3874f5d7979b30a84951d7d17b288492f7b9327) | `(0,0)` gives **VALUE 0 versus DIV_ZERO**; MINIMAL_WITNESS at the minimum-rank domain corner |
| C: integer rounding | `0xf064a743787993Be5F05A2430506CA8869a9Fe33` | [Deploy](https://explorer-studio.genlayer.com/tx/0x60b2b6b271e437a60e6ddb08bc13a9b33799e0e300e1d5e4f2bfc537047f37e1) | [Find witness](https://explorer-studio.genlayer.com/tx/0xef1caef22dfae228bf07652a91a56f8108a40c560b15b99087c0589273b240c4) | `(1,2)` gives **1 versus 0**; EXHAUSTED_WITH_WITNESS |
| D: commutative addition | `0xC07e633c37802c774835B656716a30a74295455F` | [Deploy](https://explorer-studio.genlayer.com/tx/0x7dc6d84eef4d3b55f8cf7daf5b16389d2ec52857bcb451a684045f21365cb5fb) | [First search](https://explorer-studio.genlayer.com/tx/0x9990c1f89607c77be922bf25bec1fa6dd92e9dc26ac470e5c5e49a0e653ca1ea), [second search](https://explorer-studio.genlayer.com/tx/0x41556111c69d570037ef560bad7ccd3fb9fa5fe67dd51de8b8ac76edc7efe9d7) | No witness saved; EXHAUSTED_NO_WITNESS, **not an equivalence certificate** |

The six leader searches stored 25 proposed input pairs in total: A tested six and then eight, B tested three, C tested eight, and D returned empty proposal lists twice. Every recorded execution is replayed by the verifier. The second A search found no strict improvement and retained the first witness unchanged. For misses, the deployed validator logic additionally runs its own model search; a concrete validator improvement would reject the leader's miss.

Only B's lower-corner witness receives a global minimum-rank claim. A and C make no claim of globally minimal counterexamples. Neither real-world software correctness nor the trustworthiness of the chosen reference follows from these demonstrations.

## Rejected requests

Each rejection finalized with an `ERROR` execution, the expected decoded cause, and identical pre/post state.

- [Stale attempt after A progressed](https://explorer-studio.genlayer.com/tx/0xcd76ce68d2de3caebf6273d99870e10aeb30852fa7b6de3cb33a61c3b2687c39): [request and state](stale-search.json), [decoded receipt](stale-search-decoded-receipt.json).
- [Search after A exhausted its budget](https://explorer-studio.genlayer.com/tx/0x73a3af3037c421e6afcb90073a4fc12e8b5cc96061b0b006a5ee13aa1eb25a2d): [request and state](a-terminal.json), [decoded receipt](a-terminal-decoded-receipt.json).
- [Search after B's terminal witness](https://explorer-studio.genlayer.com/tx/0x821513897afb45e935ef7a0587828baedd12ebfcc94c21119400c3444cbeb3d7): [request and state](b-terminal.json), [decoded receipt](b-terminal-decoded-receipt.json).

## Reproduction and integrity

[Deployment manifests](deployments.json) bind the actual addresses, full program sources, byte hashes, domains, budgets and callers. [Transaction journal](transactions.json) enumerates all 13 hashes. Every receipt is retained as `*-receipt.json`; each write additionally preserves complete before/after notebook states. [Verification summary](verification.json) records finality, execution results, vote counts and fresh state agreement.

The verifier re-fetches all receipts, checks exact destination and sender, strict majority and expected execution result, then compares saved votes. It verifies the immutable source/domain/budget binding and every snapshot transition. The independent BigInt interpreter executes every stored input pair, reproduces errors and values, computes strict rank improvements and verifies the incumbent history and terminal status. It also checks the exact deployed contract source bytes and fresh `get_state` reads for all four instances.

```sh
node scripts/verify-proofs.cjs --offline
# Fresh verification requires the GenLayer CLI and an unlocked account:
node scripts/verify-proofs.cjs
```

- [Successful CLI deployment, live searches and fresh verification](https://github.com/mahdidaawsh-commits/counter-forge/actions/runs/39052882796).
- [Passing CI](https://github.com/mahdidaawsh-commits/counter-forge/actions/runs/39052813000): **64 direct tests**, [hosted report](cloud-direct-tests.xml).
- Tests compare **513 programs** against the separate BigInt interpreter and check all **1,681** signed operand pairs from -20 through 20 for division and remainder. They explicitly replay validators, verify independent search on a miss, and reject changed source bytes, malformed sources, bad input domains and stale or terminal calls. Direct tests use mocks; the deployed searches use live web/model consensus.
- Contract SHA-256: `eff012c9af0647b9033a9b731df6029edba267545f1528f3c5341d68ad9cede2`.
- Program revision: `75b06c7296be4fbb8e5547fe8ccb7de4e7de18ea`.

These are selected program fixtures for the documented restricted integer DSL. They demonstrate executable witnesses and lifecycle behavior, not arbitrary-code auditing, broad model accuracy, production-software safety or a monetary bounty.
