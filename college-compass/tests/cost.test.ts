import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, monthlyPayment } from "../src/lib/cost";
import { makeCollege, makeStudent } from "./helpers";

test("COA sums all reported components", () => {
  const c = estimateCost(makeStudent(), makeCollege());
  // in-state: 10000 + 2000 + 13000 + 1200 + 1000 + 1800
  assert.equal(c.coa, 29000);
  assert.equal(c.coaIncomplete, false);
  assert.equal(c.residency, "in_state");
});

test("out-of-state tuition applies when home state differs", () => {
  const c = estimateCost(makeStudent({ homeState: "TX" }), makeCollege());
  assert.equal(c.tuition, 30000);
  assert.equal(c.coa, 49000);
  assert.equal(c.residency, "out_of_state");
});

test("gift aid reduces net price; loans/work-study never appear in net", () => {
  const c = estimateCost(makeStudent(), makeCollege(), { extraScholarships: 3000 });
  assert.equal(c.giftAid, 11000); // 8000 grants + 3000 scholarships
  assert.equal(c.netAnnual, 18000); // 29000 − 11000
  assert.equal(c.net4Year, 72000);
});

test("gift aid is capped at COA and net never goes negative", () => {
  const c = estimateCost(makeStudent(), makeCollege(), { extraScholarships: 100000 });
  assert.equal(c.giftAid, 29000);
  assert.equal(c.netAnnual, 0);
});

test("borrowing = gap between net cost and family budget", () => {
  const c = estimateCost(makeStudent({ maxAnnualBudget: 15000 }), makeCollege());
  // net = 29000 − 8000 = 21000; gap = 6000/yr
  assert.equal(c.borrowingAnnual, 6000);
  assert.equal(c.borrowing4Year, 24000);
  assert.ok((c.monthlyLoanPayment as number) > 0);
});

test("no borrowing when budget covers net cost", () => {
  const c = estimateCost(makeStudent({ maxAnnualBudget: 50000 }), makeCollege());
  assert.equal(c.borrowingAnnual, 0);
  assert.equal(c.monthlyLoanPayment, 0);
});

test("missing components are unreported, not zero", () => {
  const c = estimateCost(makeStudent(), makeCollege({ books: null, transportation: null }));
  assert.equal(c.coa, 26800);
  assert.equal(c.coaIncomplete, true);
});

test("fully missing cost data yields null COA and net", () => {
  const c = estimateCost(
    makeStudent(),
    makeCollege({
      tuitionInState: null, tuitionOutState: null, fees: null, housingMeals: null,
      books: null, transportation: null, personalExpenses: null,
    }),
  );
  assert.equal(c.coa, null);
  assert.equal(c.netAnnual, null);
  assert.equal(c.borrowingAnnual, null);
});

test("income-band net price implies band-specific grants", () => {
  const c = estimateCost(
    makeStudent({ householdIncomeRange: "0_30000" }),
    makeCollege({ netPriceByIncome: { "0_30000": 9000 } }),
  );
  assert.equal(c.usedIncomeBandNetPrice, true);
  assert.equal(c.grants, 20000); // 29000 COA − 9000 band net price
  assert.equal(c.netAnnual, 9000);
});

test("monthly payment amortization is sane (10yr @ 6.53%)", () => {
  const p = monthlyPayment(24000);
  assert.ok(p > 270 && p < 280, `expected ~273, got ${p}`);
  assert.equal(monthlyPayment(0), 0);
});
