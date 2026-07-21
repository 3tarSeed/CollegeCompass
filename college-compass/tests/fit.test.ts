import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFit, satToAct } from "../src/lib/fit";
import { makeCollege, makeStudent } from "./helpers";

test("strong stats at an accessible school → Likely", () => {
  const r = classifyFit(
    makeStudent({ actSuperscore: 33, gpaUnweighted: 3.9 }),
    makeCollege({ acceptanceRate: 0.7, act25: 22, act75: 28 }),
  );
  assert.equal(r.category, "Likely");
});

test("scores below range at a selective school → Reach or High Reach", () => {
  const r = classifyFit(
    makeStudent({ actSuperscore: 24, actComposite: 23, gpaUnweighted: 3.2 }),
    makeCollege({ acceptanceRate: 0.25, act25: 30, act75: 34 }),
  );
  assert.ok(r.category === "Reach" || r.category === "High Reach", r.category);
});

test("sub-15% acceptance rate is always at best a Reach", () => {
  const r = classifyFit(
    makeStudent({ actSuperscore: 36, gpaUnweighted: 4.0, apCourses: 12 }),
    makeCollege({ acceptanceRate: 0.05, act25: 33, act75: 35 }),
  );
  assert.ok(r.category === "Reach" || r.category === "High Reach", r.category);
  assert.ok(r.explanations.some((e) => e.includes("reach for every applicant")));
});

test("never outputs a probability, always explains", () => {
  const r = classifyFit(makeStudent(), makeCollege());
  assert.ok(r.explanations.length > 0);
  for (const e of r.explanations) {
    assert.ok(!/\d+\s*%\s*(chance|probability)/i.test(e), e);
  }
});

test("confidence drops to Limited with sparse data", () => {
  const r = classifyFit(
    makeStudent({ actComposite: null, actSuperscore: null, satScore: null, gpaUnweighted: null, apCourses: 0, honorsCourses: 0 }),
    makeCollege({ acceptanceRate: null, act25: null, act75: null, sat25: null, sat75: null }),
  );
  assert.equal(r.confidence, "Limited");
});

test("full data yields High confidence", () => {
  const r = classifyFit(makeStudent(), makeCollege());
  assert.equal(r.confidence, "High");
});

test("SAT is used when ACT is missing", () => {
  const withSat = classifyFit(
    makeStudent({ actComposite: null, actSuperscore: null, satScore: 1500 }),
    makeCollege({ acceptanceRate: 0.6, act25: 24, act75: 29 }),
  );
  assert.equal(withSat.category, "Likely");
  assert.equal(satToAct(1500), 34);
});

test("test-blind schools ignore scores", () => {
  const r = classifyFit(
    makeStudent({ actSuperscore: 36 }),
    makeCollege({ testPolicy: "blind", acceptanceRate: 0.5 }),
  );
  assert.ok(r.explanations.some((e) => e.toLowerCase().includes("test-blind")));
});
