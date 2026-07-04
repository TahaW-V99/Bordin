import assert from "node:assert/strict";
import {
  actualOutcome,
  calculatePredictionAccuracy,
  calculateWorkbookPredictionAccuracy,
  marginError,
  predOutcome,
  sameOutcome,
  scoreError,
} from "./prediction-accuracy";

function expectAccuracy(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  expected: number,
  label: string,
) {
  const actual = calculateWorkbookPredictionAccuracy(
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
  );
  assert.equal(
    actual,
    expected,
    `${label}: pred ${predictedHome}-${predictedAway} vs actual ${actualHome}-${actualAway} => ${actual}, expected ${expected}`,
  );
  assert.equal(
    calculatePredictionAccuracy(predictedHome, predictedAway, actualHome, actualAway),
    expected,
    `calculatePredictionAccuracy alias mismatch for ${label}`,
  );
}

// Helper cells
assert.equal(scoreError(3, 1, 1, 0), 3);
assert.equal(marginError(3, 1, 1, 0), 1);
assert.equal(predOutcome(2, 2), "D");
assert.equal(predOutcome(2, 1), "H");
assert.equal(predOutcome(1, 2), "A");
assert.equal(actualOutcome(1, 1), "D");
assert.equal(sameOutcome(2, 1, 3, 0), 1);

// Exact score
expectAccuracy(2, 1, 2, 1, 100, "exact score");

// Both draw branch
expectAccuracy(0, 0, 0, 0, 100, "exact 0-0");
expectAccuracy(1, 1, 2, 2, 70, "both draw E2=2 J2>0");
expectAccuracy(2, 2, 1, 1, 70, "both draw E2=2 J2>0");
expectAccuracy(1, 1, 0, 0, 50, "both draw J2=0 E2=2");

// Actual draw, predicted not draw
expectAccuracy(2, 1, 1, 1, 70, "actual draw pred home E2=1");
expectAccuracy(1, 3, 2, 2, 40, "actual draw pred away E2=2 H2=A J2>0");
expectAccuracy(0, 2, 0, 0, 0, "actual draw J2=0 E2=2");

// Predicted draw, actual not draw
expectAccuracy(1, 1, 1, 0, 70, "pred draw actual home E2=1");
expectAccuracy(0, 0, 0, 2, 30, "pred draw actual away E2=2 J2<4");
expectAccuracy(2, 2, 4, 1, 20, "pred draw actual home E2=3");

// Same outcome G2=1
expectAccuracy(2, 0, 2, 1, 90, "same outcome E2=1 home side one off");
expectAccuracy(3, 1, 2, 1, 80, "same outcome E2=1 away matched");
expectAccuracy(3, 0, 7, 0, 20, "same outcome E2=4");
expectAccuracy(3, 1, 1, 0, 60, "same outcome E2=3 F2<=1 K2>1");

// Different outcome default branch
expectAccuracy(5, 2, 1, 1, 0, "opposite outcome E2=5");
expectAccuracy(0, 1, 2, 1, 30, "opposite outcome E2=2 J2<4");
expectAccuracy(2, 0, 0, 2, 10, "opposite outcome E2=4");

// Workbook regression cases from scripts/test-accuracy.mjs
expectAccuracy(3, 1, 1, 0, 60, "Ivory Coast");
expectAccuracy(2, 1, 2, 2, 70, "Netherlands");
expectAccuracy(3, 0, 7, 0, 20, "Germany");
expectAccuracy(5, 2, 1, 1, 0, "Brazil");
expectAccuracy(2, 1, 1, 1, 70, "Qatar");
expectAccuracy(2, 0, 2, 1, 90, "one goal off away");
expectAccuracy(3, 1, 4, 1, 80, "home one off away same");
expectAccuracy(0, 0, 2, 1, 20, "pred draw wrong");
expectAccuracy(2, 1, 2, 0, 90, "home win one goal off away");
expectAccuracy(2, 1, 1, 0, 70, "home win settled early at 1-0");

console.log("prediction-accuracy workbook tests passed");
