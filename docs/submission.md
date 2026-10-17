Category: Builder → Intelligent Contracts

Title: CounterForge: Replayable AI counterexample search

CounterForge is a GenLayer differential-testing notebook for bounded integer programs. It pins two sources, hashes, an input domain and a search budget. AI proposes inputs; validators independently fetch, parse and execute both programs, accepting only genuine behavioral differences that improve the incumbent's rank. They verify exact values, runtime errors and ordering. A leader miss triggers independent validator search; misses never become equivalence claims. The notebook retains proposals, executions, callers and monotone history. Four StudioNet deployments prove a joint-cap mismatch, division-by-zero divergence, rounding mismatch and exhausted no-witness search. All 13 transactions finalized with MAJORITY_AGREE, including stale-call and terminal-replay rejections. Includes 64 tests, 513 cross-language interpreter checks and 1,681 signed operand pairs. The restricted DSL demonstrates replayable synthesis, not arbitrary-code auditing, production safety or general model accuracy.

Repository: https://github.com/mahdidaawsh-commits/counter-forge

Contract: https://github.com/mahdidaawsh-commits/counter-forge/blob/main/contracts/counter_forge.py

Proofs: https://github.com/mahdidaawsh-commits/counter-forge/blob/main/proofs/README.md

StudioNet contract: 0x9701B7C4C32E583d03c08B92C19209798C6A9577

Deployment: https://explorer-studio.genlayer.com/tx/0x3deb51ea858c02356f45df624bf869ce4ac05bc2f385d99e51d291e730866b6c
