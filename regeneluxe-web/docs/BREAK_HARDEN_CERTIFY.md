# ReGeneLuxe — Permanent Break / Harden / Upgrade Standard

Reliability-focused development rule. Feature completion alone is **not** sufficient.

Every meaningful feature or sprint must use:

**BUILD → BREAK → HARDEN → POLISH → CERTIFY**

This standard complements `docs/LAYERED_BUILD.md` (architecture / promotion layers) and `docs/RUNTIME.md` (process lifecycle).

---

## BUILD

Implement the smallest complete vertical slice.

Do **not** stop because:

- UI renders
- API returns 200
- a unit test passes
- the happy path works

---

## BREAK

After implementation, deliberately try to break the feature.

Test at minimum where relevant:

| Area | Adversarial cases |
|------|-------------------|
| Identity / session | wrong user · wrong workspace · expired session · logout/login · browser reopen |
| Auth / OAuth | expired OAuth token · revoked permission · missing env/config |
| Inputs | malformed input · duplicate submission · double click · concurrent / rapid repeated request |
| Continuity | page refresh mid-action · server restart mid-action · worker crash · stale RUNNING job · process restart |
| Provider | wrong provider · wrong destination · network timeout · 4xx · 5xx · partial success · duplicate response · readiness changes at dispatch |
| Content / assets | missing asset · stale asset · asset/content/schedule changed after approval · approval expired · release gate changes |
| Data / jobs | database lock/error · duplicate job · duplicate publish attempt · stale frontend cache · stale backend state |

Do not stop at the first bug. Continue until the feature survives the adversarial matrix.

---

## CROSS-FEATURE BREAKAGE

Test whether a new feature breaks existing systems, including where adjacent:

auth · accounts · campaigns · content · queue · approval · scheduler · provider connections · analytics · inbox · external agents · workspace isolation

Every major sprint requires regression checks across adjacent systems.

---

## UX BREAK TESTING

Test whether a normal operator could:

- misunderstand status
- select the wrong account
- publish to the wrong destination
- think CONNECTED means READY
- miss an important blocker
- approve something unintentionally
- confuse TEST with PRODUCTION
- click twice
- become stuck in a dead end
- be forced to refresh manually
- see stale data after an action

If yes: **fix the workflow**. Do not blame operator error when the interface can prevent it.

---

## RUNTIME BREAK TESTING

For runtime-critical systems:

- repeated health probes
- repeated route navigation
- scheduler cycles
- process restart
- database reopen
- browser reload
- logout/login
- idle period
- resumed activity

Verify the **intended process** stays alive and state remains correct. A silent restart after a crash does **not** count as a pass.

---

## CHAOS TESTING

For scheduled publishing and background operations, simulate:

- process crash before send
- process crash during claim
- process crash after provider response but before local commit
- retry after provider timeout
- duplicate worker
- duplicate queue item
- stale lease
- provider connection disappears at send time

**No scenario may produce an uncontrolled duplicate publish.**

---

## DATA INTEGRITY

Before and after adversarial testing verify:

- workspace boundaries
- credential boundaries
- asset ownership
- content ownership
- campaign attribution
- approval binding
- publication history
- analytics attribution

Never “repair” data silently unless the operation is explicitly safe and auditable.

---

## UPGRADE PASS (HARDEN → POLISH)

After break testing, inspect whether the implementation can be:

- simpler
- more resilient
- less duplicated
- easier to understand
- easier to recover
- easier to monitor

Do not refactor merely for style. Refactor when it reduces real operational risk or friction.

---

## BUG CLASSES

Every discovered bug should be classified by severity:

`CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `COSMETIC`

And by root type:

`AUTH` · `WORKSPACE` · `DATA` · `RUNTIME` · `PROVIDER` · `SCHEDULER` · `AGENT` · `UI` · `CACHE` · `CONCURRENCY` · `RECOVERY` · `CONFIG` · `OTHER`

Recurring failure patterns must become visible.

---

## RELEASE GATE (CERTIFY)

A release-critical feature may **not** be called GREEN until:

1. Happy path passes
2. Negative path passes
3. Concurrency/retry behavior passes where relevant
4. Restart recovery passes
5. Workspace isolation passes
6. Security boundary passes
7. UX confusion test passes
8. Full regression suite passes
9. Live TEST-workspace certification passes where provider-facing

---

## PERMANENT QUESTIONS

Do not ask only: “Does it work?”

Ask:

- How can this fail?
- How can the operator misuse it?
- How can another subsystem break it?
- What happens when the process dies?
- What happens when the provider lies, times out, or changes state?
- What happens if this happens twice?
- What happens if the wrong workspace is active?

Try to break ReGeneLuxe before the operator does.

The goal is not a large test count. The goal is **fewer surprises in real use**.
