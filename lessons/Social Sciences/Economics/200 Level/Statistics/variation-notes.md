# Statistics for Economics — Department-Specific Applications

*Social Sciences, Economics, 200 Level*

**This folder builds on the shared core content in
`Science/Mathematics/200 Level/Statistics` — read that first.** This
covers only what's specific to economic data analysis, on top of that
shared foundation.

## 1. Time Series Data

Economic data is usually observed sequentially over time (GDP, inflation,
unemployment by quarter/year), which introduces two issues not covered
in the general statistics core:

- **Trend** — long-run upward or downward movement
- **Autocorrelation** — a value at one point in time is correlated with
  its own past values, which violates the "independent observations"
  assumption behind many standard hypothesis tests, so specialized
  time-series methods are needed rather than applying the general
  hypothesis testing framework directly.

## 2. Index Numbers in Economics

Beyond the general concept, economics relies heavily on chained and
weighted indices — e.g., a **GDP deflator** or **Laspeyres price index**
uses fixed base-period quantities as weights, while a **Paasche index**
uses current-period quantities — the choice of weighting affects the
result and is a classic economics-specific nuance on top of the general
index number concept.

## 3. Elasticity as a Statistical Relationship

**Price elasticity of demand** = (% change in quantity demanded) / (%
change in price) — conceptually similar to the regression slope
interpretation from the shared core, but expressed as a ratio of
percentage changes rather than absolute units, which makes it
comparable across goods with very different price scales.

## 4. Correlation vs. Causation in Economic Data

This warning from the shared core notes matters even more in economics,
where controlled experiments are rare — most economic data is
observational. Economists lean on techniques like **instrumental
variables** and **natural experiments** specifically to work around
this limitation, distinguishing correlation from causal effect when a
randomized controlled trial isn't possible.

## 5. Practice Problems

1. Nigeria's inflation rate (year-on-year) for six consecutive quarters
   is given. Explain why a standard hypothesis test assuming independent
   observations would be inappropriate here, and what that tells you
   about the data's autocorrelation.
2. If the price of a good rises by 10% and quantity demanded falls by
   4%, calculate the price elasticity of demand and classify the good as
   elastic or inelastic.

---
*Read the shared core Statistics notes first — this folder only covers
what's specific to economic data analysis.*
