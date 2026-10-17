# CounterForge

AI searches for counterexamples. Validators execute the proof.

CounterForge is a standalone GenLayer differential-testing notebook for a restricted integer-expression language. A deployment fixes reference/candidate source URLs and SHA-256 hashes, an input rectangle and a bounded search budget. Each search acquires the full pinned sources inside the nondeterministic flow and asks the model for concrete candidate inputs. Validators independently fetch and interpret both sources, then execute them to verify actual divergence and strict improvement over the incumbent.

Unlike a model's claim that code is correct or defective, the result is a source-bound, replayable input/output witness. Candidate inputs are proposed nondeterministically; their consequences are verified exactly. If the leader finds no improvement, validators independently search before accepting that miss. No number of failed searches becomes an equivalence or safety certificate.

- [Pinned GenLayer source](contracts/counter_forge.py)
- [Language, consensus design and limitations](docs/architecture.md)
- [Direct tests and cross-language checks](tests/direct/test_forge.py)
- [Independent BigInt interpreter](scripts/integer-oracle.cjs)
- [Small program fixtures](programs)
- [Onchain proof status](proofs/README.md)
- [Submission draft](docs/submission.md)

```sh
pip install -r requirements-dev.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/counter_forge.py --json
python -m pytest -q
node scripts/check-scenarios.cjs
```

Constructor: `reference_url`, `reference_hash`, `candidate_url`, `candidate_hash`, `bounds`, `search_budget`. Bounds are `[xmin,xmax,ymin,ymax]`, nonnegative integers at most 10^9. Budget is 1–8. Call `discover(expected_attempt)` using the current zero-based attempt count. Inspect `get_state` for full sources, tested inputs, exact behaviors, incumbent and history. Terminal states prevent further searches; a witness at the lower-left domain corner proves the minimum possible rank.

The language supports bounded arithmetic, comparisons and lazy conditionals. It does not execute arbitrary Python, Solidity, untrusted generated code or real deployed applications. A difference is relative to the chosen programs and interpreter, not proof that the reference is correct or that production software is vulnerable. The chosen fixtures demonstrate mechanism behavior, not general model accuracy. No funds or security certificates are issued.

CLI/receipt transport and test-environment helpers reuse MIT infrastructure from [WaldRail](https://github.com/mahdidaawsh-commits/wald-rail) and [BrierCommit](https://github.com/ehsanisildur-ux/brier-commit). CounterForge implements a different product mechanism: proof-carrying input synthesis, exact differential execution and monotone witness improvement.
