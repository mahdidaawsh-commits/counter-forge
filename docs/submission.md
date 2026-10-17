Category: Builder → Intelligent Contracts

Title: CounterForge: Replayable AI counterexample search

CounterForge is a GenLayer differential-testing notebook for bounded integer programs. A deployment pins two complete source files, hashes, an input domain and a search budget. AI proposes concrete inputs; validators independently fetch, parse and execute both programs, accepting only genuine behavioral differences that improve the incumbent's rank. They verify values, runtime errors and strict ordering rather than trusting model classifications. A leader miss triggers independent validator search; missed witnesses never become equivalence claims. The append-only notebook retains proposals, exact executions, callers and monotone improvements. Tests cover lazy branches, floor division, error precedence, budget exhaustion, stale calls and a separate BigInt interpreter. The restricted language supports reusable calculator and transformation checks without executing arbitrary code. Selected fixtures demonstrate replay, not general bug-finding accuracy or production-software safety.

Repository: https://github.com/mahdidaawsh-commits/counter-forge

Contract: https://github.com/mahdidaawsh-commits/counter-forge/blob/main/contracts/counter_forge.py

Proofs: https://github.com/mahdidaawsh-commits/counter-forge/blob/main/proofs/README.md
