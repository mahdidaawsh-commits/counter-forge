# CounterForge

## Consensus boundary

CounterForge is a bounded, public differential-testing notebook. The constructor freezes two commit-pinned integer-program URLs, their raw SHA-256 hashes, a rectangular input domain and a search budget. Anyone triggers a search. GenLayer's model proposes concrete integer inputs from the full program contents. Validators independently fetch, parse and execute both programs. Only replayable differences may improve the onchain witness.

This is proof-carrying synthesis: the model can search a domain of over 10^18 input pairs, while checking a proposed witness requires only two small interpreter executions. Validators need not reproduce the same proposed input when they can prove its substantive property exactly. They check actual program behavior, not a hash length, schema or model confidence. On a search miss, validators additionally run an independent model search and disagree if they find an improvement. A miss records failed search effort, never equivalence or safety.

Offchain tooling prepares source files and a comparison plan. The contract owns source acquisition, input validation, independent witness replay, strict improvement order, bounded search history and terminal budget enforcement. Source publishers own the chosen programs; the reference is not automatically correct, official or trusted. A witness proves a difference under the defined interpreter, not a vulnerability in arbitrary software.

## Program language

Each full UTF-8 JSON source is exactly `{"format":"CounterForge-v1","expression":EXPR}`. Expressions are integer constants between -10^12 and 10^12, `"x"`, `"y"`, or prefix arrays. Unary operators are `abs` and `neg`. Binary operators are `add`, `sub`, `mul`, `div`, `mod`, `min`, `max`, `lt`, `le` and `eq`. `if` has three operands and evaluates only its chosen branch. Comparisons return 0 or 1; any nonzero condition is true. Binary operands evaluate left to right; the first error propagates.

Programs have at most 64 nodes and depth 12. Evaluated integers lie in the symmetric range [-(2^127-1), 2^127-1]. An intermediate result outside that range yields RANGE, even if a later operation would shrink it. Division by zero yields DIV_ZERO. Division floors toward negative infinity, with remainder `a - b*floor(a/b)`. A behavior is a VALUE decimal string or an ERROR code. Different values, value/error pairs or different error codes are counterexamples; two identical errors are not. There is no Python evaluation, generated code execution, filesystem access, loop or external call in the program language.

## Search and state

Inputs are nonnegative integers within the frozen domain. The model may propose up to eight pairs; duplicate pairs collapse. Invalid model schemas, booleans, out-of-domain inputs or oversized outputs fail the transaction. Every proposal is evaluated and saved. A candidate is usable only if behaviors differ and rank `(x+y, x, y)` is strictly smaller than the incumbent's rank. The best usable proposed witness becomes the new incumbent. This order is well founded and deterministic; it does not imply global minimality.

A witness at the domain's lower-left corner has the minimum possible rank and produces MINIMAL_WITNESS, ending the search early. Otherwise, spending the immutable budget (1–8 attempts) produces EXHAUSTED_WITH_WITNESS or EXHAUSTED_NO_WITNESS. The latter explicitly makes no equivalence claim. Active states are SEARCHING_WITH_WITNESS and SEARCHING_NO_WITNESS. No owner can reset the budget, replace sources, delete witnesses or widen the domain. `discover(expected_attempt)` rejects stale calls before acquisition, avoiding unintended extra searches after concurrent progress.

The first accepted search stores the full source bundle. Each subsequent accepted attempt appends the caller, concrete proposals, independently reproducible executions, selected improvement and incumbent snapshot. Search misses consume budget but preserve the incumbent. Storage is bounded by the source limits, eight attempts and eight input pairs per attempt. Matching external failures finalize an unsuccessful transaction without consuming budget; malformed model output is not accepted by validators.

## Why independent search is conditional

For a FOUND result, replaying both fixed programs at the submitted inputs proves the consequential divergence and improvement. Requiring another model to find that same input would weaken liveness without adding evidence. For a MISS result there is no witness to replay as a positive proof, so the validator independently searches and rejects a miss when its own candidates contain an improvement. Even unanimous failed searches do not prove absence; all stored status names retain that distinction.

## Limits and threat model

Source hashes bind bytes, not correctness, authorship or real deployment provenance. This restricted integer DSL is a reusable, precisely specified testing target; it does not execute production Python, Solidity or arbitrary repositories. A selected reference may be buggy. Models may miss easy witnesses or stop at local improvements. Domain bounds exclude all other inputs. Anyone can consume the public search budget; there is no reserved entitlement to future searches. Chosen demonstrations illustrate replay and lifecycle behavior, not general bug-finding accuracy. This contract holds no funds and issues no security certificate or monetary reward.

Generic CLI/receipt transport and direct-test environment helpers reuse MIT infrastructure from earlier contracts. The program language, proof-carrying search, independent execution checks and monotone witness notebook are the product mechanism implemented here.
