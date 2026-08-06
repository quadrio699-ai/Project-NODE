# Data Structures and Algorithms — Study Notes

*Computer Science, 200 Level*

## 1. Big-O Notation

Big-O describes how an algorithm's running time or space requirement
grows as input size (n) grows — worst-case behavior, ignoring constant
factors and lower-order terms.

Common complexities, fastest to slowest:

| Notation | Name | Example |
|---|---|---|
| O(1) | Constant | Array index access |
| O(log n) | Logarithmic | Binary search |
| O(n) | Linear | Single loop through an array |
| O(n log n) | Linearithmic | Merge sort, quicksort (average case) |
| O(n²) | Quadratic | Nested loops, bubble sort |
| O(2ⁿ) | Exponential | Naive recursive Fibonacci |

## 2. Arrays vs. Linked Lists

| Operation | Array | Linked List |
|---|---|---|
| Access by index | O(1) | O(n) |
| Insert/delete at start | O(n) (shift elements) | O(1) |
| Insert/delete at end | O(1) amortized | O(1) with tail pointer, else O(n) |
| Insert/delete in middle | O(n) | O(n) to find + O(1) to link |
| Memory layout | Contiguous | Scattered, linked by pointers |

Arrays win on random access and cache locality; linked lists win when
frequent insertion/deletion happens away from the ends.

## 3. Stacks and Queues

- **Stack** — Last-In-First-Out (LIFO). Core operations: push, pop, peek,
  all O(1). Used in function call management (the call stack),
  expression evaluation, undo functionality, and depth-first traversal.
- **Queue** — First-In-First-Out (FIFO). Core operations: enqueue,
  dequeue, both O(1) with a proper implementation (e.g., circular buffer
  or linked list with head/tail pointers). Used in breadth-first
  traversal, task scheduling, and buffering.

## 4. Trees

A **binary tree** has at most two children per node. A **Binary Search
Tree (BST)** additionally maintains the invariant: left subtree values <
node value < right subtree values.

BST operations average O(log n) for balanced trees, but degrade to O(n)
in the worst case (a tree that's effectively a linked list, e.g., after
inserting sorted data in order). This is why **self-balancing trees**
(AVL trees, Red-Black trees) exist — they guarantee O(log n) by
rebalancing after insertions/deletions.

**Tree traversals:**
- **In-order** (left, node, right) — visits BST nodes in sorted order
- **Pre-order** (node, left, right) — useful for copying a tree
- **Post-order** (left, right, node) — useful for deleting a tree safely
- **Level-order** (breadth-first, using a queue) — visits level by level

## 5. Hash Tables

A hash table maps keys to values using a **hash function** to compute an
index into an underlying array. Average-case O(1) lookup, insert, and
delete — but collisions (two keys hashing to the same index) must be
handled:

- **Chaining** — each bucket holds a linked list (or similar) of all
  entries hashing to it.
- **Open Addressing** — on collision, probe for the next open slot
  (linear probing, quadratic probing, or double hashing).

A good hash function distributes keys uniformly to minimize collisions;
a poor one degrades performance toward O(n).

## 6. Sorting Algorithms

| Algorithm | Best | Average | Worst | Stable? | In-place? |
|---|---|---|---|---|---|
| Bubble Sort | O(n) | O(n²) | O(n²) | Yes | Yes |
| Insertion Sort | O(n) | O(n²) | O(n²) | Yes | Yes |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | Yes | No |
| Quicksort | O(n log n) | O(n log n) | O(n²) | No | Yes |
| Heapsort | O(n log n) | O(n log n) | O(n log n) | No | Yes |

**Merge Sort** — divide the array in half recursively until each piece
has one element, then merge sorted halves back together. Guaranteed
O(n log n) but needs O(n) extra space.

**Quicksort** — pick a pivot, partition elements smaller/larger than it
around it, recurse on each partition. Fast in practice and in-place, but
worst case (already-sorted data with a poor pivot choice) degrades to
O(n²) — mitigated by randomized or median-of-three pivot selection.

## 7. Graph Basics

A graph consists of vertices (nodes) and edges (connections), which may
be directed or undirected, weighted or unweighted.

- **Breadth-First Search (BFS)** — explores level by level using a
  queue; finds the shortest path in an unweighted graph.
- **Depth-First Search (DFS)** — explores as far as possible along each
  branch using a stack (or recursion) before backtracking; useful for
  cycle detection, topological sorting, and connected components.
- **Dijkstra's Algorithm** — finds shortest paths from a source vertex in
  a weighted graph with non-negative edge weights, using a priority
  queue to always expand the currently-closest unvisited vertex.

## 8. Recursion and Recurrence Relations

A recursive algorithm's running time is often expressed as a recurrence
relation, solved using the **Master Theorem** for divide-and-conquer
algorithms of the form T(n) = aT(n/b) + f(n):

- If f(n) = O(n^(log_b(a) − ε)) for some ε > 0, then T(n) = Θ(n^log_b(a))
- If f(n) = Θ(n^log_b(a)), then T(n) = Θ(n^log_b(a) · log n)
- If f(n) = Ω(n^(log_b(a) + ε)), then T(n) = Θ(f(n))

Example: Merge sort has T(n) = 2T(n/2) + O(n) → log_b(a) = log₂2 = 1, and
f(n) = Θ(n¹) matches case 2 → T(n) = Θ(n log n).

## 9. Practice Problems

1. Trace through a merge sort on [8, 3, 5, 1, 9, 2] step by step.
2. Given a BST, write out the in-order, pre-order, and post-order
   traversal sequences for a tree of your choosing.
3. Explain why quicksort's worst case is O(n²) and describe one strategy
   to avoid triggering it.
4. Given a hash table of size 7 using linear probing, insert keys 10,
   17, 24, 3 (hash function: key mod 7) and show the resulting table.

---
*These notes cover the standard core of an undergraduate Data Structures
and Algorithms course. Supplement with your specific course syllabus and
lecturer's material.*
