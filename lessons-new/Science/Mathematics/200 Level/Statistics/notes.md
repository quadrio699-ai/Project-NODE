# Statistics — Core Concepts

*Mathematics, 200 Level (canonical — shared core, referenced by other departments)*

## 1. Descriptive Statistics

**Measures of central tendency:**
- **Mean** — sum of values ÷ count. Sensitive to outliers.
- **Median** — the middle value when sorted. Robust to outliers.
- **Mode** — the most frequent value. Useful for categorical data.

**Measures of dispersion:**
- **Range** — max − min.
- **Variance (σ²)** — average of squared deviations from the mean:
  σ² = Σ(xᵢ − x̄)² / n (population) or ÷ (n−1) for a sample (Bessel's
  correction, which corrects for the bias of estimating variance from a
  sample rather than the full population).
- **Standard Deviation (σ)** — √variance. Same units as the original
  data, which is why it's used more often than variance for
  interpretation.

## 2. Probability Fundamentals

- **P(A)** — probability of event A, always between 0 and 1.
- **P(A ∪ B) = P(A) + P(B) − P(A ∩ B)** — addition rule (subtracting the
  overlap so it isn't double-counted).
- **P(A ∩ B) = P(A) × P(B)** — multiplication rule, but only if A and B
  are **independent**.
- **Conditional Probability:** P(A|B) = P(A ∩ B) / P(B) — the
  probability of A given that B has already occurred.
- **Bayes' Theorem:** P(A|B) = [P(B|A) × P(A)] / P(B) — lets you reverse
  a conditional probability, foundational for a huge range of
  applications from medical testing to spam filtering.

## 3. Probability Distributions

- **Normal Distribution** — the bell curve; defined by mean (μ) and
  standard deviation (σ). About 68% of values fall within 1σ of the
  mean, 95% within 2σ, 99.7% within 3σ (the "68-95-99.7 rule").
- **Binomial Distribution** — models the number of successes in n
  independent trials, each with success probability p. Mean = np,
  Variance = np(1−p).
- **Poisson Distribution** — models the number of events in a fixed
  interval, given a known average rate (λ). Mean = Variance = λ.

## 4. Sampling and the Central Limit Theorem

A **sample** is a subset drawn from a **population**. The **Central
Limit Theorem (CLT)** states that the distribution of sample means
approaches a normal distribution as sample size grows, *regardless of
the underlying population's distribution* — this is why so much of
inferential statistics can rely on normal-distribution assumptions even
when the raw data isn't normally distributed.

**Standard Error (SE)** = σ / √n — describes how much sample means vary
from the true population mean. It shrinks as sample size grows, which is
why larger samples give more reliable estimates.

## 5. Hypothesis Testing

The standard framework:

1. State the **null hypothesis (H₀)** — typically "no effect" or "no
   difference" — and the **alternative hypothesis (H₁)**.
2. Choose a **significance level (α)** — commonly 0.05 (5%), the
   threshold probability for rejecting H₀ when it's actually true (a
   Type I error).
3. Calculate a **test statistic** (z-score, t-statistic, chi-square,
   etc., depending on the test) and its corresponding **p-value**.
4. If p-value < α, **reject H₀** — the result is "statistically
   significant" at that level.

**Type I error** — rejecting a true H₀ (false positive).
**Type II error** — failing to reject a false H₀ (false negative).

## 6. Correlation and Regression

**Correlation coefficient (r)** ranges from −1 to 1, measuring the
strength and direction of a linear relationship between two variables.
r = 0 doesn't mean no relationship — only no *linear* one.

**Simple Linear Regression:** ŷ = a + bx, where b (the slope) is
estimated to minimize the sum of squared residuals (the vertical
distances between actual and predicted values) — the "least squares"
method.

**Important distinction:** correlation does not imply causation. Two
variables can move together because of a shared underlying cause, pure
coincidence, or reverse causation — not necessarily because one causes
the other.

## 7. Practice Problems

1. A dataset has values 4, 8, 6, 5, 3, 9, 7. Find the mean, median, and
   standard deviation.
2. A coin is flipped 10 times. Using the binomial distribution, what's
   the probability of getting exactly 6 heads (p = 0.5)?
3. A sample of 40 has a mean of 72 and standard deviation of 12. Compute
   the standard error, and construct an approximate 95% confidence
   interval for the population mean.

---
*This is the shared, canonical core of an introductory Statistics
course. Departments building on this (see their own folder's
variation-notes for department-specific applications) should treat this
as the common foundation, not something to be rewritten per department.*
