# Business Statistics — Department-Specific Applications

*Management Sciences, Business Administration, 200 Level*

**This folder builds on the shared core content in
`Science/Mathematics/200 Level/Statistics` — read that first.** What
follows here is only the business-specific applications layered on top
of that shared foundation, so the core concepts (descriptive statistics,
probability, distributions, hypothesis testing, regression) aren't
repeated.

## 1. Business Applications of Hypothesis Testing

- **A/B testing** — comparing two versions of a product, price, or
  marketing approach by testing whether the difference in a metric
  (conversion rate, average order value) is statistically significant
  or just noise.
- **Quality control** — testing whether a production process's defect
  rate has changed from a known baseline.

## 2. Forecasting with Regression

Businesses commonly use simple linear regression (from the shared core)
to forecast metrics like sales against time, spend against revenue, or
price against demand. The key addition at the business level is
interpreting the **slope coefficient in business terms** — e.g., "for
every ₦1 increase in ad spend, revenue increases by ₦4.20 on average" —
and being explicit about the model's limits (extrapolating far outside
the observed data range is unreliable).

## 3. Index Numbers

Common in business/economic reporting — a single number expressing the
relative change in a variable (price, quantity) over time relative to a
base period (set to 100). The **Consumer Price Index (CPI)** is the
most familiar real-world example: it tracks the average change in
prices of a basket of goods over time relative to a base year.

## 4. Decision Making Under Uncertainty

Building on the shared probability content: **Expected Value (EV)**
decision-making — choosing between options by comparing the
probability-weighted average outcome of each, the same underlying math
as EMV covered in the Project Management notes, applied here to
business decisions like whether to launch a product or enter a new
market.

## 5. Practice Problems

1. A company runs an A/B test on two ad designs. Design A converts 120
   of 2,000 viewers, Design B converts 150 of 2,000 viewers. Is the
   difference statistically significant at α = 0.05? (Hint: this is a
   two-proportion z-test, building on the hypothesis testing framework
   from the shared core notes.)
2. Given advertising spend and revenue data for 6 months, describe how
   you'd use simple linear regression to forecast next month's revenue,
   and what assumption you'd need to be cautious about.

---
*Read the shared core Statistics notes first — this folder only covers
what's specific to business applications.*
