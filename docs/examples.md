# Reading the program fixtures

These are selected small comparisons, not a general accuracy benchmark. Known witness values in `config/scenarios.json` support direct tests and expected witness presence. They are not passed to the deployed constructor or search prompt. Live search receives only the source expressions, bounds and any incumbent discovered in earlier attempts.

| Pair | Reference | Candidate | Concrete demonstration |
| --- | --- | --- | --- |
| A | `min(x+y, 1000000)` | `min(x,1000000)+min(y,1000000)` | `(1000000,1)` gives 1000000 versus 1000001. The sum crosses the joint cap even though both individual terms are within their caps. |
| B | `0 if y == 0 else floor(x/y)` | `floor(x/y)` | `(0,0)` gives VALUE 0 versus DIV_ZERO. Lazy conditional execution avoids evaluating the invalid division in the reference. |
| C | `floor((x+y-1)/y)` | `floor(x/y)` | `(1,2)` gives 1 versus 0. Integer rounding changes the behavior. This domain requires y >= 1. |
| D | `x+y` | `y+x` | Tested inputs have identical behavior. Exhausting a search still produces EXHAUSTED_NO_WITNESS, not an equivalence certificate. |

Pairs A, B and D allow zero coordinates; pair C excludes a zero denominator. A has a two-attempt budget to demonstrate monotone improvement or a failed improvement search. B and C have one attempt each; D has two. All coordinates are bounded by the deployment's immutable rectangle.

The live proof verifier accepts any actual source-backed counterexample, rather than requiring a preselected witness. It independently executes every saved proposal with BigInt arithmetic, reproduces the rank choice, checks the notebook history and compares fresh chain reads. A model may find a different or smaller witness than those shown above. Only a witness at the lower-left domain corner receives the contract's globally minimal-rank status; the other cases claim no global minimality.
