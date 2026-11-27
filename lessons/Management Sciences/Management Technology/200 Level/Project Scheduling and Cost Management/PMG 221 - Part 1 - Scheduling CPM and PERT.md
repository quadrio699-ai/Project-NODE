# PMG 221 Project Scheduling and Cost Management - Part 1

## Scheduling, Network Analysis, CPM and PERT

*Lecture handout (PMT 200 Level), converted for Project-NODE. Figures were diagrams in the original; they are described in words here.*

---

## Chapter 1: Scheduling

**Scheduling** is the listing of the activities, deliverables and milestones in a project. A schedule normally shows a planned start and finish date, the duration, and the resources assigned to each activity. Good scheduling is central to time management.

### Plan versus schedule

| | **Project plan** | **Project schedule** |
|---|---|---|
| Purpose | Outlines scope, objectives and strategies | Gives the timeline for executing tasks |
| Focus | Comprehensive, high-level overview | Detailed and task-oriented |
| Scope | The entire project | Specific tasks and timelines |
| Timeframe | Long-term | Short-term, immediate tasks |
| Flexibility | Allows adjustment | More rigid, with fixed timelines |

- A **plan** covers scope, objectives, strategies, tactics, resource allocation, risk, quality, communication and stakeholder engagement. It answers: what, why, how, who, when.
- A **schedule** covers tasks, start and end dates, dependencies, durations, resource assignments, milestones and deadlines, plus the critical path.
- The plan is the foundation for the schedule; the schedule operationalises the plan. Changes to one affect the other.
- **Best practice:** build the plan before the schedule, keep both aligned with the objectives, review both regularly, tell stakeholders about changes, and use project management tools.
- **Tools:** Gantt charts, project software (MS Project, Asana, Trello), mind maps, CPM, PERT.

### Types of project schedule

- **Gantt chart** - lists tasks along a timeline showing timeframes, dependencies and progress. It is not a WBS, but works well with one.
- **Kanban** - cards on a board, columns for workflow stages; ideal for Agile projects with continuous monitoring.
- **Calendars** - give the WBS a time structure and track deadlines, milestones and resource availability; best for strict deadlines.
- WBS types that support scheduling: **deliverable-based** (breaks the project into outputs) and **phase-based** (breaks it into stages, good for software and construction).

---

## Chapter 2: Mathematical analysis - network analysis

### Key concepts

- **Activity** - a piece of work that takes time; drawn as an arrow.
- **Event** - the beginning or end of an activity; drawn as a circle (a **node**). An event takes place at a point in time; an activity takes place over a period.
- **Predecessor event** - the event just before another; **successor event** - the event just after.
- **Network** - the related activities and events that result in an end product, in a fixed sequence (e.g. foundation before walls).
- **Dummy activity** - an activity that consumes **no time**; used to keep the logic of the network correct.
- A network has one **start event** and one **end event**, with directed arrows for activities.

### Worked example: drawing a network

| Activity (event to event) | Name | Immediate predecessor |
|---|---|---|
| 1 to 2 | A | none |
| 1 to 3 | B | none |
| 1 to 4 | C | none |
| 2 to 5 | D | A |
| 3 to 6 | E | B |
| 4 to 6 | F | C |
| 5 to 6 | G | D |

A, B and C start from node 1. D follows A (nodes 2 to 5), E follows B (3 to 6), F follows C (4 to 6), G follows D (5 to 6). Node 6 is the end event.

## 2.1 Critical Path Method (CPM)

CPM finds the **time to complete a project** and the **critical activities** that management must watch. It was developed by DuPont for shutting down and restarting chemical plants for maintenance.

**Steps in CPM planning**
1. Specify the individual activities.
2. Determine their sequence.
3. Draw the network diagram.
4. Estimate the completion time of each activity (CPM uses single, fixed estimates and ignores variation).
5. Identify the **critical path** (the longest path through the network).
6. Update the diagram as the project progresses.

**The four times for each activity**
- **ES** earliest start; **EF** earliest finish = ES + duration.
- **LF** latest finish (without delaying the project); **LS** latest start = LF - duration.
- **Slack (float)** = LS - ES (or LF - EF).
- The **critical path** is the path where every activity has zero slack (ES = LS and EF = LF). A delay on it delays the whole project. To shorten the project, you must shorten activities on the critical path.

**Forward pass** (earliest time, TE): start at the start event with TE = 0. For each next event, TE = TE of previous event + activity time. If several activities come in, take the **maximum**.

**Backward pass** (latest time, TL): start at the end event, where TL = its TE. Moving back, TL = TL of the next event - activity time. If several activities leave, take the **minimum**.

**Floats**
- **Total float** TF = LS - ES = (TL - TE) - t
- **Free float** FF = (Ej - Ei) - t (delay possible without affecting the earliest start of the next activity)
- **Independent float** IF = (Ej - Li) - t (negative values are taken as zero)

An activity is critical only if TL - TE = 0 at its events and TLj - t - TEj = 0.

**Benefits:** a graphical view of the project; predicts completion time; shows which activities are critical. **Limitation:** ignores variation in activity times, so it suits routine projects with little uncertainty.

### Worked example 1

| Activity | Predecessor | Time (weeks) |
|---|---|---|
| A | - | 3 |
| B | A | 5 |
| C | A | 7 |
| D | B | 10 |
| E | C | 5 |
| F | D, E | 4 |

- Path I: A-B-D-F = 3 + 5 + 10 + 4 = **22 weeks**
- Path II: A-C-E-F = 3 + 7 + 5 + 4 = **19 weeks**
- Critical path = Path I; critical activities A, B, D, F; project time **22 weeks**. C and E are non-critical and together can be delayed by up to 3 weeks (22 - 19).

### Worked example 2

Activities with times: A 4 (1-2), B 1 (1-3), C 1 (2-4), D 1 (3-4), E 6 (3-5), F 5 (4-9), G 6 (5-6), H 8 (5-7), I 1 (6-8), J 2 (7-8), K 5 (8-10), L 7 (9-10).

Critical path: 1 to 3 to 5 to 7 to 8 to 10. Critical activities **B, E, H, J, K**. Project time = 1 + 6 + 8 + 2 + 5 = **22 days**.

## 2.2 PERT (Program Evaluation and Review Technique)

PERT is a network model that **allows for randomness** in activity times. It was developed in the late 1950s for the US Navy's Polaris project, which had thousands of contractors. It uses statistical methods and helps a manager monitor a project continuously and take corrective action.

**Assumption:** precise time estimates are usually impossible, so PERT uses **three estimates** for each activity:
- **Optimistic time (OT / to)** - the shortest possible time.
- **Most likely time (MT / tm)** - the time with the highest probability.
- **Pessimistic time (PT / tp)** - the longest time the activity might need.

**Expected time:** te = (OT + 4 x MT + PT) / 6

**Variance:** [(PT - OT) / 6] squared

PERT is usually drawn as an **activity-on-arc** network (activities on lines, milestones on nodes). Number the events in tens (10, 20, 30...) so new ones can be inserted later.

**Steps:** identify activities and milestones, sequence them, draw the network, estimate times, determine the critical path, update as the project progresses.

The **variance of the project completion time** is the sum of the variances of the critical-path activities. This lets you work out the probability of finishing by a given date. Shortening the project by adding resources to the critical path is called **crashing**.

**Benefits:** expected completion time; probability of finishing before a given date; critical activities; activities with slack that can lend resources; start and end dates.
**Limitations:** time estimates are subjective and may be biased; the most serious problem is underestimating the completion time because other paths become critical.

### Example: which expert is more certain?

| Expert | to | tm | tp |
|---|---|---|---|
| A | 4 | 6 | 8 |
| B | 4 | 7 | 10 |

Variance A = [(8 - 4)/6] squared = 4/9 = 0.44. Variance B = [(10 - 4)/6] squared = 1. A has the smaller variance, so **A is more certain** about the estimate.

### Example: project completion time using PERT

| Activity | Predecessor | to | tm | tp | te |
|---|---|---|---|---|---|
| A | - | 2 | 4 | 6 | 4 |
| B | A | 3 | 6 | 9 | 6 |
| C | A | 8 | 10 | 12 | 10 |
| D | B | 9 | 12 | 15 | 12 |
| E | C | 8 | 9 | 10 | 9 |
| F | D, E | 16 | 21 | 25 | 21 |
| G | D, E | 19 | 22 | 26 | 22 |
| H | F | 2 | 5 | 8 | 5 |
| I | G | 1 | 3 | 5 | 3 |

Paths: A-B-D-F-H = 48; A-B-D-G-I = 47; A-C-E-F-H = **49**; A-C-E-G-I = 48.
Critical path A-C-E-F-H; critical activities **A, C, E, F, H**; project time **49 days**. B, D, G, I are non-critical.

## 2.3 Crashing a project

**Crashing** shortens project time by putting extra labour or machines on one or more activities. It costs more; the aim is to shorten the project at **minimum extra cost**. Assumption: time and cost are **linearly related**.

**Steps**
1. Find the critical path using normal times and costs.
2. Work out the **crash cost per unit time** for each activity:
   crash cost per unit time = (crash cost - normal cost) / (normal time - crash time)
3. Choose the **critical** activity with the **smallest** crash cost per unit time and crash it as far as allowed.
4. Recompute the critical path (a non-critical path may now become critical) and repeat.

### Worked example (costs in naira)

| Activity | Predecessor | Normal time (weeks) | Crash time | Normal cost | Crash cost | Crash cost per week |
|---|---|---|---|---|---|---|
| A | - | 4 | 3 | 8,000 | 9,000 | 1,000 |
| B | A | 5 | 3 | 16,000 | 20,000 | 2,000 |
| C | A | 4 | 3 | 12,000 | 13,000 | 1,000 |
| D | B | 6 | 5 | 34,000 | 35,000 | 1,000 |
| E | C | 6 | 4 | 42,000 | 44,000 | 1,000 |
| F | D | 5 | 4 | 16,000 | 16,500 | 500 |
| G | E | 7 | 6 | 66,000 | 72,000 | 6,000 |
| H | C | 4 | 3 | 2,000 | 5,000 | 3,000 |

Goal: cut the project time by 3 weeks. The lecture identifies the critical path with activities **A, C, E, G, H** (25 weeks normally). Among these the cheapest crash cost per week is N1,000 (A, C, E). Crash A by 1 week (N1,000), then C by 1 week (N1,000), then E by 1 week (N1,000).

**Result:** reduce A, C and E by one week each; project time becomes **22 weeks**; extra cost **N3,000**.

*Note: the handout's table lists H's predecessor as C, but its diagram places H after G on the critical path. Check the network with your lecturer.*
*Note: the handout says "the maximum among them is N1,000" when choosing which to crash. The rule is to choose the **minimum** crash cost per unit time, which is what the worked answer actually does.*

## 2.4 Fast tracking

**Fast tracking** means doing activities **in parallel** that were originally planned in sequence, after checking there is no critical dependency. Example: aggregating baseline data was planned to start after all data collection, but database preparation can begin earlier. It shortens the timeline without adding resources, though it can add risk.

---

## Exercise

1. Distinguish between a project and a programme.
2. Identify the advantages and limitations of PERT.
3. State the steps used in CPM project planning.
4. Explain network analysis.
5. A company wants to crash a project by spending no more than N2,000 extra. Activities (normal time, crash time, normal cost, crash cost): A 7/6, N15,000/N18,000; B (after A) 12/9, N11,000/N14,000; C (after A) 22/21, N18,500/N19,000; D (after B) 11/10, N8,000/N9,000; E (after C, D) 6/5, N4,000/N4,500. Suggest how this can be done.

## Related notes

- Next: *PMG 221 Part 2* (simulation, resource levelling, WBS, dependencies) and *Part 3* (cost management and earned value).
- Planning context: *PMG 223 Project Planning, Control and Work Based Learning*.
- Applied CPM and earned value calculations: *Principles of Project Management* (300 Level).
- The probability and variance ideas in PERT build on *Statistics* (200 Level, Science / Management Sciences).
