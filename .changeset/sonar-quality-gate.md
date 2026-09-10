---
'@leyline/core': patch
'@leyline/schema': patch
---

Fixes the SonarQube quality gate findings and adds the rules behind them to `pnpm lint`, so they surface locally. The reorder permutation check now compares sets rather than sorting both sides as text, and `validateChange` and `validateWorkflow` are each split into one function per case.
