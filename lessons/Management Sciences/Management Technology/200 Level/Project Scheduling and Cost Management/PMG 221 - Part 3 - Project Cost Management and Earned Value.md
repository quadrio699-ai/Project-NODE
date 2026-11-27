# PMG 221 Project Scheduling and Cost Management - Part 3

## Project Cost Management, Depreciation and Earned Value Management

*Lecture handout (PMT 200 Level), converted for Project-NODE.*

---

## What is project cost management?

- **Cost** is a resource given up to achieve a specific objective, usually measured in money (naira, dollars).
- **Project cost management** is the set of processes that ensure a project is completed **within the approved budget**.

**Four processes**
1. **Plan cost management** - set the policies, procedures and documentation for planning, managing, spending and controlling costs.
2. **Estimate costs** - approximate the cost of the resources needed.
3. **Determine budget (cost budgeting)** - allocate the overall estimate to individual work items to create an authorised cost baseline.
4. **Control costs** - monitor the project and manage changes to the cost baseline.

**Purpose:** develop a budget from the scope, identify resources that need cost, make better estimates, allocate the estimate to work items, control budget changes.

## Basic principles

- Profit = revenue - expenses. Executives care about financial terms, so project managers must speak them.
- **Life cycle costing** considers the total cost of ownership (development plus support).
- **Cash flow analysis** finds the annual costs and benefits and the resulting cash flow.
- **Tangible** costs/benefits are easily measured in money; **intangible** ones are hard to measure.
- **Direct costs** relate directly to the project's products; **indirect costs** are incurred for the project but not directly tied to its products.
- **Sunk cost** is money already spent. Do **not** include sunk costs when deciding whether to continue a project (law of diminishing returns: the more you put in, the less you get out).
- **Learning curve theory:** unit cost falls in a regular pattern as more units are produced.
- **Reserves:** **contingency reserves** cover "known unknowns" and are in the cost baseline; **management reserves** cover "unknown unknowns".

**Types of cost:** **variable** (changes with the work, e.g. food for seminar participants), **fixed** (does not change, e.g. seminar hall rent), **direct** (e.g. hiring a PA system), **indirect** (shared, e.g. venue electricity).

## Depreciation

Depreciation is the loss of value over time. Three methods (example: purchase price N140,000, salvage value N40,000, 5 years):

1. **Straight line:** equal amount each year. (140,000 - 40,000) / 5 = **N20,000 per year**.
2. **Double declining balance:** applied to the book value without subtracting salvage value. Rate = 2 x (1/5) = 40%. Year 1 = N56,000; year 2 = 40% of 84,000 = N33,600; year 3 = N20,160; year 4 = N12,096; year 5 = N7,258 (book value ends near N10,886).
3. **Sum of the years' digits:** sum = 1 + 2 + 3 + 4 + 5 = 15. Depreciation each year = (years remaining / 15) x depreciable value (N100,000): year 1 = 5/15 = N33,333; year 2 = 4/15 = N26,667; year 3 = N20,000; year 4 = N13,333; year 5 = N6,667.

## Plan cost management

**Inputs:** project management plan (scope baseline, schedule baseline), project charter, enterprise environmental factors (culture, market conditions, exchange rates, published cost data), organisational process assets (financial controls, historical information).
**Tools:** expert judgment; analytical techniques (funding choices, payback period, ROI, IRR, discounted cash flow, NPV); planning meetings.
**Output:** the **cost management plan**.

## Estimate costs

Approximate the cost of each activity's resources: labour, materials, equipment, facilities, IT, plus inflation and contingency. Estimates are in currency (or hours) and become **more accurate as the project progresses**.

**Accuracy of estimates:** a **rough order of magnitude (ROM)** estimate in the initiating phase is about -50% to +50%; a control estimate later is about -10% to +10%.

**Techniques**
- **Analogous (top-down):** uses costs of past similar projects. Cheap and quick but **least accurate**; used when information is limited.
- **Bottom-up:** the people doing the work estimate each work package, then roll the numbers up. **More accurate**, but needs detailed information.
- **Parametric:** a mathematical model (e.g. cost per metre, cost per installation). Needs accurate historical data, quantifiable parameters and a scalable model.
- **Three-point (PERT):** (optimistic + 4 x most likely + pessimistic) / 6.
- **Reserve analysis**, **cost of quality**, estimating software, **vendor bid analysis**.

**Outputs:** activity cost estimates; **basis of estimates** (assumptions, constraints, range such as N10K plus or minus 10%, confidence level); updates to project documents such as the risk register.

## Determine budget

**Outputs:** the **cost performance baseline** (budget by phase, shown as an **S-curve**) and **project funding requirements** (cost baseline plus management reserves, provided in increments).

## Control costs

Influence the factors that change the cost baseline; act on change requests quickly; make sure spending does not exceed authorised funding; monitor performance against funds spent; block unapproved changes; inform stakeholders of approved changes; keep overruns within acceptable limits.

Key task: determine the **cause and size of a variance** and decide whether corrective action is needed. Tools: cost change control system, performance measurement analysis (EVM), forecasting, performance reviews (variance and trend analysis), project software.

---

## Earned Value Management (EVM)

EVM integrates **scope, cost and schedule** to measure project performance. It needs an integrated baseline and works for any project in any industry.

### The three key values

- **Planned Value (PV)** (formerly BCWS): the budgeted cost of the work **scheduled** to be done by a given time.
- **Earned Value (EV)** (formerly BCWP): the budgeted value of the work **actually completed**.
- **Actual Cost (AC)** (formerly ACWP): the money **actually spent** on the work done.

### Formulas

| Measure | Formula | Meaning |
|---|---|---|
| Cost variance (CV) | EV - AC | Negative = over budget |
| CV% | CV / EV | |
| Schedule variance (SV) | EV - PV | Negative = behind schedule |
| SV% | SV / PV | |
| Cost performance index (CPI) | EV / AC | Below 1 = over budget; above 1 = under budget |
| Schedule performance index (SPI) | EV / PV | Below 1 = behind schedule; above 1 = ahead |
| Budget at completion (BAC) | total of all PVs | The total budget |
| Estimate to complete (ETC) | BAC - EV (atypical variance) or (BAC - EV) / CPI (typical variance) | Cost to finish the remaining work |
| Estimate at completion (EAC) | AC + ETC; AC + (BAC - EV); AC + (BAC - EV)/CPI; or BAC / CPI | Expected total cost |
| Variance at completion (VAC) | BAC - EAC | |
| To-complete performance index (TCPI) | (BAC - EV) / (BAC - AC), or (BAC - EV) / (EAC - AC) | Performance needed on remaining work |

Healthy project: CV and SV are 0 or more; CPI and SPI are 1 or more.

### Example 1: painting a house

A painter is hired for 3 months at N2,700 (N900 a month). Paint is estimated at N3,600. After 1 month he has done 20% of the work but used 40% of the paint.

- Total budget = 2,700 + 3,600 = N6,300
- PV = 6,300 / 3 = **N2,100**
- EV = 20% of 6,300 = **N1,260**
- AC = 900 + 40% of 3,600 = 900 + 1,440 = **N2,340**
- CV = 1,260 - 2,340 = **-N1,080** (over budget)
- SV = 1,260 - 2,100 = **-N840** (behind schedule)
- CPI = 1,260 / 2,340 = **0.54**; SPI = 1,260 / 2,100 = **0.6**

### Example 2: replacing check-out scanners

A retailer replaces 5 scanners a week for 24 weeks at N2,500 each. After 4 weeks, 22 scanners are done, costing an average of N3,000 each.

- Weekly cost = 5 x 2,500 = N12,500; **BAC** = 24 x 12,500 = **N300,000**
- PV = 4 x 12,500 = **N50,000**; EV = 22 x 2,500 = **N55,000**; AC = 22 x 3,000 = **N66,000**
- CV = 55,000 - 66,000 = **-N11,000** (over budget)
- CPI = 55,000 / 66,000 = **0.83** (83 kobo of value for every naira spent)
- SV = 55,000 - 50,000 = **+N5,000** (ahead of schedule); SPI = 1.10
- EAC = BAC / CPI = 300,000 / 0.8333 = **N360,000**
- ETC = EAC - AC = 360,000 - 66,000 = **N294,000**
- VAC = BAC - EAC = **-N60,000**
- TCPI (to hit the original BAC) = (300,000 - 55,000) / (300,000 - 66,000) = **1.05**
- TCPI (against the revised EAC of 360,000) = (300,000 - 55,000) / (360,000 - 66,000) = **0.83**

*The handout's table has a few slips (it writes ETC as EAC/AC and the BAC as 3,000,000). The values above are the corrected ones.*

### Example 3: product development

Budget N900,000; 6 months; 12,000 hours. Schedule says 34% should be done; the project is 37% complete; 48% of the budget is used.

- BAC = 900,000; AC = 48% x 900,000 = **432,000**
- PV = 0.34 x 900,000 = **306,000**; EV = 0.37 x 900,000 = **333,000**
- CV = 333,000 - 432,000 = **-99,000**; CPI = 0.77 (**over budget**)
- SV = 333,000 - 306,000 = **27,000**; SPI = 1.08 (**ahead of schedule**)

### Consulting example (BCWS, ACWP, BCWP)

A N40,000 information-system project over 4 months has 20 tasks (N2,000 each, 5 tasks a month), so the plan is N10,000 per month (BCWS). At the end of month 1 the consultant invoices N8,000 (ACWP) but only 3 of 5 tasks are complete, so the earned value (BCWP) is N6,000. Spending N8,000 to earn N6,000 of work shows a cost problem; N6,000 earned against N10,000 planned shows a schedule problem.

**Rate of performance:** actual work completed compared with the percentage of work planned. If a server installation is half complete when it should be 100% complete, the rate of performance is 50%.

## Related notes

- Scheduling and CPM/PERT: *PMG 221 Part 1*.
- Earned value is used again in *Principles of Project Management* (300 Level), and project finance appears in the Project Finance note.
- The three-point (PERT) estimate here is the same formula used for scheduling.
