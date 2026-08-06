# Linear Algebra — Study Notes

*Mathematics, 200 Level*

## 1. Vectors and Vector Spaces

A vector space over a field (typically the real numbers, ℝ) is a set V
equipped with addition and scalar multiplication satisfying eight axioms:
closure, associativity and commutativity of addition, existence of a zero
vector, existence of additive inverses, and compatibility of scalar
multiplication (distributivity over vector addition, distributivity over
scalar addition, associativity, and the identity scalar 1).

**Subspace test:** A subset W of a vector space V is a subspace if and
only if:
1. The zero vector is in W
2. W is closed under addition
3. W is closed under scalar multiplication

## 2. Linear Independence and Span

A set of vectors {v₁, v₂, ..., vₙ} is **linearly independent** if the only
solution to c₁v₁ + c₂v₂ + ... + cₙvₙ = 0 is c₁ = c₂ = ... = cₙ = 0. If any
other solution exists, the vectors are linearly dependent — meaning at
least one can be written as a combination of the others.

The **span** of a set of vectors is the set of all possible linear
combinations of them. A **basis** for a vector space is a linearly
independent spanning set — every vector in the space can be written
uniquely as a combination of basis vectors. The number of vectors in a
basis is the **dimension** of the space.

## 3. Matrices as Linear Transformations

An m×n matrix A represents a linear transformation from ℝⁿ to ℝᵐ. Key
transformation properties to know:

- **Rank** — the dimension of the column space (equivalently, the row
  space); the number of linearly independent columns (or rows).
- **Nullity** — the dimension of the null space (kernel): all vectors x
  such that Ax = 0.
- **Rank-Nullity Theorem:** rank(A) + nullity(A) = n (the number of
  columns).

## 4. Solving Systems via Row Reduction

Gaussian elimination reduces a matrix to **row echelon form** (REF) —
zeros below each leading entry — using three elementary row operations:
swap two rows, multiply a row by a nonzero scalar, add a multiple of one
row to another. Continuing to **reduced row echelon form** (RREF) —
leading entries are 1, and are the only nonzero entry in their column —
makes the solution set directly readable.

Worked example:

```
[ 1  2  1 | 8 ]      [ 1  0  0 | 3 ]
[ 2  1  1 | 6 ]  →   [ 0  1  0 | 1 ]
[ 1  1  2 | 7 ]      [ 0  0  1 | 2 ]
```

Solution: x = 3, y = 1, z = 2.

## 5. Determinants

For a 2×2 matrix, det = ad − bc. For larger matrices, cofactor expansion
or row reduction (tracking sign changes from row swaps and scaling
factors) both work. Key facts:

- det(A) ≠ 0 if and only if A is invertible
- det(AB) = det(A)·det(B)
- det(Aᵀ) = det(A)
- Swapping two rows flips the sign of the determinant

## 6. Eigenvalues and Eigenvectors

For a square matrix A, an eigenvector v (nonzero) and eigenvalue λ satisfy
**Av = λv** — A scales v without changing its direction.

Eigenvalues are found by solving the **characteristic equation**:
det(A − λI) = 0.

Worked example — A = [[4, 1], [2, 3]]:

det(A − λI) = (4−λ)(3−λ) − 2 = λ² − 7λ + 10 = 0 → λ = 5 or λ = 2.

For λ = 5: (A − 5I)v = 0 → [[-1, 1], [2, -2]]v = 0 → v = (1, 1) (or any
scalar multiple).

For λ = 2: [[2, 1], [2, 1]]v = 0 → v = (1, -2).

**Diagonalization:** if A has n linearly independent eigenvectors, then
A = PDP⁻¹, where D is diagonal (eigenvalues on the diagonal) and P's
columns are the corresponding eigenvectors. This makes repeated
operations like Aᵏ much easier to compute: Aᵏ = PDᵏP⁻¹.

## 7. Orthogonality and the Gram-Schmidt Process

Two vectors are orthogonal if their dot product is zero. An
**orthonormal basis** consists of mutually orthogonal unit vectors.
Gram-Schmidt converts any basis {v₁, ..., vₙ} into an orthogonal one
{u₁, ..., uₙ}:

- u₁ = v₁
- u₂ = v₂ − proj_{u₁}(v₂)
- u₃ = v₃ − proj_{u₁}(v₃) − proj_{u₂}(v₃)
- ...continuing, subtracting the projection onto each previous u

where proj_u(v) = (v·u / u·u) · u.

## 8. Practice Problems

1. Determine whether the vectors (1, 2, 3), (2, 4, 6), (1, 0, 1) are
   linearly independent.
2. Find the eigenvalues and eigenvectors of A = [[2, 0], [0, 3]].
3. Use Gaussian elimination to solve: x + y + z = 6, 2y + 5z = -4,
   2x + 5y − z = 27.
4. Compute the determinant of [[1, 2, 3], [0, 1, 4], [5, 6, 0]].

---
*These notes cover the standard core of an undergraduate Linear Algebra
course. Supplement with your specific course syllabus and lecturer's
material.*
