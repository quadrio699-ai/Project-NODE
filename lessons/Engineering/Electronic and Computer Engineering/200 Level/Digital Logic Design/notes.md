# Digital Logic Design — Study Notes

*Electronic and Computer Engineering, 200 Level*

## 1. Number Systems and Conversion

Digital systems operate in binary, but octal and hexadecimal are used as
shorthand since they convert to/from binary cleanly (each octal digit =
3 bits, each hex digit = 4 bits).

**Binary to Decimal:** sum each bit × its positional power of 2.
Example: 1011₂ = 1×8 + 0×4 + 1×2 + 1×1 = 11₁₀

**Decimal to Binary:** repeated division by 2, reading remainders bottom-up.

**Two's Complement** (for signed binary): to negate a number, invert all
bits and add 1. This lets subtraction be performed as addition, which
simplifies ALU (Arithmetic Logic Unit) hardware design.

## 2. Boolean Algebra Fundamentals

Core identities every digital design course relies on:

| Law | Expression |
|---|---|
| Identity | A + 0 = A, A · 1 = A |
| Null | A + 1 = 1, A · 0 = 0 |
| Idempotent | A + A = A, A · A = A |
| Complement | A + A' = 1, A · A' = 0 |
| Double Negation | (A')' = A |
| Commutative | A + B = B + A |
| Associative | (A+B)+C = A+(B+C) |
| Distributive | A·(B+C) = A·B + A·C |
| Absorption | A + A·B = A |

**De Morgan's Theorems** (critical for simplification and NAND/NOR-only
implementations):
- (A + B)' = A' · B'
- (A · B)' = A' + B'

## 3. Logic Gates

The seven basic gates: AND, OR, NOT, NAND, NOR, XOR, XNOR. NAND and NOR
are called **universal gates** — either one alone can implement any
Boolean function, which matters for chip fabrication since a single gate
type simplifies manufacturing.

XOR truth table (outputs 1 only when inputs differ):

| A | B | A⊕B |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

## 4. Karnaugh Maps (K-Maps)

K-maps simplify Boolean expressions visually by grouping adjacent 1s in
powers of 2 (1, 2, 4, 8...). Adjacent cells differ by exactly one bit
(Gray code ordering), so grouping them eliminates the variable that
changes between them.

Worked example — simplify F(A,B,C) = Σm(0,1,2,3,5,7) (minterms):

```
        BC=00  BC=01  BC=11  BC=10
A=0       1      1      1      1
A=1       0      1      1      0
```

Grouping: the entire top row (A=0) simplifies to A'. The column BC=11
combined with BC=01 (both rows where B or the pattern holds for A=1)
gives additional terms. Working through the full grouping yields:

**F = A' + BC**

(Grouping row A=0 entirely gives A'; grouping the cells at BC=01 and
BC=11 across both rows gives BC.)

## 5. Combinational Circuits

Built purely from gates with no memory — output depends only on current
inputs.

- **Multiplexer (MUX)** — selects one of several inputs to route to a
  single output, based on select lines. An n-to-1 MUX needs log₂(n)
  select lines.
- **Demultiplexer (DEMUX)** — the reverse: routes one input to one of
  several outputs.
- **Decoder** — activates exactly one output line based on a binary
  input code (e.g., a 3-to-8 decoder for addressing 8 memory locations).
- **Encoder** — the reverse: converts an active input line into a binary
  code.
- **Adder** — a **half adder** adds two bits (Sum = A⊕B, Carry = A·B); a
  **full adder** adds two bits plus a carry-in, needed to chain adders
  together for multi-bit addition.

## 6. Sequential Circuits and Flip-Flops

Unlike combinational circuits, sequential circuits have **memory** —
output depends on current inputs AND past state.

- **SR Latch** — most basic memory element, but has an invalid/undefined
  state when both Set and Reset are 1 simultaneously.
- **D Flip-Flop** — captures the input (D) on a clock edge, avoiding the
  SR latch's undefined state. The most commonly used flip-flop in
  practice.
- **JK Flip-Flop** — resolves the SR latch's invalid state; when both J
  and K are 1, it toggles the output instead.
- **T Flip-Flop** — toggles output on every clock pulse when T=1; used in
  counter designs.

**Setup and Hold Time:** the input must be stable for a minimum time
before (setup) and after (hold) the clock edge for reliable capture —
violating either causes metastability, an unpredictable output state.

## 7. Counters and Registers

- **Ripple (Asynchronous) Counter** — each flip-flop's clock is driven by
  the previous stage's output; simple but has propagation delay that
  accumulates through the chain.
- **Synchronous Counter** — all flip-flops share the same clock signal,
  avoiding ripple delay, at the cost of more complex control logic.
- **Shift Register** — stores and shifts a sequence of bits; variants
  include SISO, SIPO, PISO, PIPO (Serial/Parallel In, Serial/Parallel Out).

## 8. Practice Problems

1. Convert 213₁₀ to binary, octal, and hexadecimal.
2. Simplify F(A,B,C,D) = Σm(0,2,4,6,8,10,12,14) using a K-map.
3. Design a full adder truth table and derive its Sum and Carry-out
   Boolean expressions.
4. Explain why NAND is called a "universal gate," and show how to build
   a NOT gate using only a NAND gate.

---
*These notes cover the standard core of a 200-level Digital Logic Design
course. Supplement with your specific course syllabus and lecturer's
material.*
