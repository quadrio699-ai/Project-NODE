# Project Management Techniques — 300 Level Study Notes

*Project Management Technology, 300 Level*

These notes assume you already have the 100/200-level foundations (project
life cycle, WBS, basic scheduling, stakeholder basics) and go into the
quantitative and applied techniques a 300-level course builds on top of
that foundation.

## 1. Critical Path Method — Worked Calculation

Given a network of activities with durations and dependencies, CPM
requires a **forward pass** and **backward pass**:

**Forward pass** (Early Start / Early Finish):
- ES of the first activity = 0 (or project start)
- EF = ES + Duration
- ES of a successor = max(EF of all its predecessors)

**Backward pass** (Late Start / Late Finish), starting from the last
activity's LF = its EF from the forward pass:
- LS = LF − Duration
- LF of a predecessor = min(LS of all its successors)

**Total Float** = LS − ES (or equivalently LF − EF). Activities with
**zero float** lie on the critical path.

Worked example — four activities:

| Activity | Duration | Predecessor |
|---|---|---|
| A | 4 | — |
| B | 3 | A |
| C | 5 | A |
| D | 2 | B, C |

Forward pass: A: ES 0, EF 4 → B: ES 4, EF 7 → C: ES 4, EF 9 → D: ES 9
(max of 7, 9), EF 11.

Backward pass (project ends at 11): D: LF 11, LS 9 → C: LF 9, LS 4 → B:
LF 9 (must finish before D's LS 9), LS 6 → A: LF is min(B's LS=6, C's
LS=4) = 4, LS 0.

Float: A = 0, B = 6−4 = 2, C = 4−4 = 0, D = 0.

**Critical path: A → C → D**, duration 11. B has 2 days of float — it can
slip by up to 2 days without delaying the project.

## 2. PERT Three-Point Estimating

For activities with uncertain duration, PERT uses:

**Expected Duration (TE)** = (O + 4M + P) / 6

where O = optimistic, M = most likely, P = pessimistic estimates.

**Standard Deviation (σ)** = (P − O) / 6

For a full path, variances (σ²) of independent activities on that path
sum, and the path's standard deviation is the square root of that sum —
this lets you calculate the probability of finishing a project by a
target date using the normal distribution (Z-score = (Target − TE) / σ).

## 3. Earned Value Management (EVM)

EVM measures performance using three core values, all expressed in cost
(or equivalent) terms:

- **Planned Value (PV)** — budgeted cost of work scheduled to be done by
  this point
- **Earned Value (EV)** — budgeted cost of work actually completed
- **Actual Cost (AC)** — what was actually spent

From these:

| Metric | Formula | Interpretation |
|---|---|---|
| Schedule Variance (SV) | EV − PV | Positive = ahead of schedule |
| Cost Variance (CV) | EV − AC | Positive = under budget |
| Schedule Performance Index (SPI) | EV / PV | >1 = ahead of schedule |
| Cost Performance Index (CPI) | EV / AC | >1 = under budget |
| Estimate at Completion (EAC) | BAC / CPI | Forecast total cost if current cost performance continues |
| Estimate to Complete (ETC) | EAC − AC | Forecast remaining cost |
| To-Complete Performance Index (TCPI) | (BAC − EV) / (BAC − AC) | CPI needed on remaining work to hit the original budget |

Worked example: Budget at Completion (BAC) = ₦10,000,000. At the review
point, PV = ₦4,000,000, EV = ₦3,500,000, AC = ₦4,200,000.

- CPI = 3,500,000 / 4,200,000 = 0.83 (spending more than earning — over
  budget)
- SPI = 3,500,000 / 4,000,000 = 0.875 (behind schedule)
- EAC = 10,000,000 / 0.83 ≈ ₦12,048,000 (forecast overrun if this
  performance trend continues)

## 4. Quantitative Risk Analysis

Beyond the qualitative probability/impact matrix, 300-level work
introduces:

- **Expected Monetary Value (EMV)** = Probability × Impact (in currency),
  summed across risk scenarios, used to size contingency reserves. A risk
  with 30% probability of a ₦500,000 impact has an EMV of ₦150,000.
- **Decision Tree Analysis** — models sequential decisions under
  uncertainty by comparing EMV across branching choices (e.g., build
  in-house vs. outsource, each with its own probability-weighted outcomes).
- **Monte Carlo Simulation** — runs a project model thousands of times
  with randomly sampled durations/costs (drawn from each activity's
  probability distribution) to produce a distribution of likely project
  outcomes, rather than a single-point estimate — commonly used to state
  schedule confidence as "80% likely to finish by X date" rather than a
  single deterministic date.

## 5. Procurement Management

Contract types shift risk between buyer and seller differently:

- **Fixed-Price (FP)** — seller bears cost risk; predictable for the
  buyer but sellers may cut corners or pad estimates for uncertainty.
- **Cost-Reimbursable (CR)** — buyer bears cost risk; used when scope is
  poorly defined upfront. Variants include Cost-Plus-Fixed-Fee (CPFF) and
  Cost-Plus-Incentive-Fee (CPIF), which adds a performance-based bonus.
- **Time & Materials (T&M)** — hybrid, often used for smaller, short-
  duration work where scope can't be fully defined in advance.

## 6. Organizational Structures and Project Authority

The organizational structure a project sits in determines how much
authority the project manager actually has:

| Structure | PM Authority | Resource Availability |
|---|---|---|
| Functional | Low/none | Controlled by functional manager |
| Weak Matrix | Low | Shared, functional manager dominant |
| Balanced Matrix | Moderate | Shared, more balanced |
| Strong Matrix | Moderate/High | Shared, PM dominant |
| Projectized | High/almost total | Dedicated to the project |

In a **projectized** structure, project managers typically report
directly to executives and team members are dedicated full-time; in a
**functional** structure, the project manager is more of a coordinator
with resources borrowed from department heads who retain real authority.

## 7. Agile Metrics (for Hybrid/Applied Contexts)

Where a course blends predictive and agile approaches, common metrics
include:

- **Velocity** — amount of work (often in story points) a team completes
  per sprint, used to forecast how many sprints remain for a given backlog
- **Burndown Chart** — tracks remaining work against time within a sprint
  or release; a healthy burndown trends toward zero by the sprint's end
- **Cycle Time** — average time from when work starts on an item to when
  it's completed, a key indicator of process efficiency in Kanban-style
  flows

## 8. Practice Problems

1. Given activities E(5, pred: none), F(3, pred: E), G(6, pred: E), H(4,
   pred: F, G) — calculate ES/EF/LS/LF for each and identify the critical
   path.
2. A project has BAC = ₦8,000,000. At the current review, PV =
   ₦3,000,000, EV = ₦2,700,000, AC = ₦3,100,000. Calculate CPI, SPI, and
   EAC, and state whether the project is ahead/behind schedule and
   over/under budget.
3. A risk has a 20% chance of causing a ₦2,000,000 cost impact, and an
   alternative mitigation costs ₦300,000 upfront to reduce that
   probability to 5%. Using EMV, is the mitigation worth it?

---
*These notes build on 100/200-level project management foundations and
focus on the quantitative techniques (CPM math, PERT, EVM, quantitative
risk, procurement, organizational structures) typically introduced at
300 level. Supplement with your specific course syllabus and lecturer's
material.*
