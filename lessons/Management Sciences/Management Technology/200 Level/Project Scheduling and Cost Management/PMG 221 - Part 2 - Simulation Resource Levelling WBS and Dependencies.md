# PMG 221 Project Scheduling and Cost Management - Part 2

## Simulation, Resource Levelling, Work Breakdown Structure and Dependencies

*Lecture handout (PMT 200 Level), converted for Project-NODE.*

---

## 2.5 Simulation techniques

Some problems cannot be fully formulated or solved with mathematical models. **Simulation** is then the most suitable method, giving a near-optimal solution. A simulation is an imitation of reality: a computer imitates the operation of a whole process or system. It is widely used for risk analysis on financial processes, and for stochastic systems.

**Steps in a simulation:** define the problem, introduce the variables, construct the model, test the variables with values, simulate, examine the results, select the best alternative.

**Building blocks of a simulation model**
1. A definition of the state of the system (e.g. number of customers in a queue).
2. The possible states that can occur.
3. The possible events that change the state (arrivals, service completions).
4. A **simulation clock** that records the passage of simulated time.
5. A method for randomly generating events.
6. A formula for the state changes caused by events.

**Types:** **discrete-event** simulation (state changes at random points in time, e.g. queues) and **continuous** simulation (state changes continuously, e.g. an aeroplane in flight, which needs differential equations). Most practical simulations are discrete-event.

**Advantages:** suits large, complex problems that cannot be solved mathematically; flexible; experiments do not disturb the real system; policy decisions are faster and less risky.
**Disadvantages:** does not give optimal solutions; a good model can take long and be expensive; the decision-maker must supply all the information about conditions and constraints.

### Monte Carlo simulation

Models can be **deterministic** (alternatives known in advance) or **probabilistic** (decisions under uncertainty). **Monte Carlo** is a probabilistic method: decision variables follow a probability distribution (which can come from past records), and random samples are drawn using random numbers.

**Procedure**
1. Establish a probability distribution for the variables.
2. Find the cumulative probability distribution.
3. Set **random number intervals** for the variables and generate random numbers.
4. Simulate by picking random numbers until enough trials are done.
5. Examine the results and validate the model.

### Example: ice-cream demand

Past month: demand 4 (5 days), 5 (10 days), 6 (6 days), 7 (8 days), 8 (1 day). Divide by 30 to get probabilities, then build cumulative probabilities and random number intervals.

| Demand | Probability | Cumulative | Random number interval |
|---|---|---|---|
| 4 | 0.13 | 0.13 | 00 - 12 |
| 5 | 0.17 | 0.30 | 13 - 29 |
| 6 | 0.20 | 0.50 | 30 - 49 |
| 7 | 0.23 | 0.73 | 50 - 72 |
| 8 | 0.27 | 1.00 | 73 - 99 |

Random numbers 17, 46, 85, 09, 50, 58, 04, 77, 69, 74 give demand 5, 6, 8, 4, 7, 7, 4, 8, 7, 8 for days 1 to 10.

*Note: the probabilities in the handout do not match the day counts (e.g. 10 days out of 30 is 0.33, not 0.17). The method is what matters.*

### Example: washing machines

Daily demand 0 to 5 with probabilities 0.05, 0.25, 0.20, 0.25, 0.10, 0.15 gives random number intervals 00-04, 05-29, 30-49, 50-74, 75-84, 85-99. Ten random numbers (68, 47, 92, 76, 86, 46, 16, 28, 35, 54) give demands 3, 2, 5, 4, 5, 2, 1, 1, 2, 3, total 28, average **2.8 per day**. The expected demand is the sum of probability x demand = **2.55**. The two differ because ten trials are too few; more trials get closer to the expected value.

---

## 2.6 Resource levelling

**Resource levelling** resolves overallocation and scheduling conflicts so a project can be completed with the resources available. Resources include time, materials and tools.

- If the **deadline must be kept**, more resources may be needed.
- If the project must run with **current resources**, the deadline may have to be extended.

**Why use it:** optimise resources; minimise deficits and delays; prevent overloading team members; protect the quality of output.

**Common heuristics**
- **Priority-based:** critical path method; PERT (slack time); earliest start time.
- **Resource-based:** resource allocation technique; resource levelling algorithm; resource-constrained project scheduling.
- **Hybrid:** genetic algorithm, simulated annealing, ant colony optimisation.
- **Simple rules:** first come first served; shortest task first; longest task first.

**Tips:** use Gantt charts; use project software with levelling features; draw network diagrams; use past projects as references; make realistic estimates (estimate as a team, include risks, estimate in ranges, use the same technique each time).

---

## 2.7 Work Breakdown Structure (WBS)

A **WBS** is a hierarchical decomposition of a project into smaller components. The top is the overall goal; the next level is major deliverables, then sub-deliverables, and finally **work packages** (the smallest units of work).

**Benefits:** efficient management (clear scope, less unnecessary work); optimised work allocation; improved communication; organised ideas; better risk management.

**Key components:** phases, tasks, subtasks, deliverables, sub-deliverables, work packages, dependencies, estimates, milestones.

**How to create a WBS**
1. Define the project scope and objectives.
2. Identify the major deliverables.
3. Break deliverables into sub-deliverables.
4. Identify work packages.
5. Define the activities in each work package.
6. Create the WBS chart (a Gantt chart model can be used).

Example (mobile app): deliverables are UI design, backend development, database setup. Sub-deliverables for UI design are wireframes, mockups and design reviews.

---

## 2.8 Scheduling dependencies

A **dependency** is a task that relies on the completion of another. Examples: pouring a foundation depends on excavation; a product launch depends on finalising the design and branding; a bug fix depends on finding its root cause.

**Key terms**
- **Project constraints** - cost, time and scope (the "project management triangle"). A change in one requires changes in the others.
- **Critical path** - the longest sequence of dependent tasks; any delay in it delays the project.
- **Blocker** - anything that can prevent an activity from being completed (a team member being away, a late supplier).

**Types of dependency**
- **Logical (causal)** - necessary for completion; cannot run in parallel (you cannot delegate if you have no one to delegate to).
- **Resource** - arise from limited resources (one designer must finish Project A before starting B).
- **Preferential** - created by team processes, not strictly necessary (an editor's final review).
- **External** - depend on outside factors you cannot control (a late shipment because of weather).

**Types of task dependency**

| Type | Meaning | Example |
|---|---|---|
| **Finish to Start (FtS)** | B cannot start until A finishes (most common) | Pouring a foundation after excavation |
| **Finish to Finish (FtF)** | B cannot finish until A finishes | A parent task cannot finish until its subtasks do |
| **Start to Start (StS)** | B cannot start before A starts | Launch announcement starts when the web page goes live |
| **Start to Finish (StF)** | A cannot finish until B starts | A support agent cannot leave until the next one arrives |

**Tips for managing dependencies:** use project software; visualise dependencies (Gantt, Kanban); monitor risks, especially cross-team ones; keep stakeholders talking.

## Related notes

- Back to *PMG 221 Part 1* for CPM and PERT, and forward to *Part 3* for cost management.
- WBS and backlogs are also in *PMG 223* (Part 2).
- Dependencies and blockers connect to risk identification in *Principles of Project Management* (300 Level).
