import { calculatePredictionAccuracy } from "../src/shared/lib/prediction-accuracy.ts";

const cases = [
  { actual: [1, 0], pred: [3, 1], note: "Ivory Coast — expect ~60" },
  { actual: [2, 2], pred: [2, 1], note: "Netherlands — expect partial not 0" },
  { actual: [7, 0], pred: [3, 0], note: "Germany — expect ~50" },
  { actual: [1, 1], pred: [5, 2], note: "Brazil — expect low" },
  { actual: [1, 1], pred: [2, 1], note: "Qatar — expect partial" },
  { actual: [2, 1], pred: [2, 0], note: "expect ~90" },
  { actual: [4, 1], pred: [3, 1], note: "expect ~90" },
  { actual: [2, 1], pred: [0, 0], note: "expect low" },
  { actual: [4, 1], pred: [2, 1], note: "expect ~75" },
  { actual: [1, 1], pred: [2, 2], note: "expect ~80 draw" },
  { actual: [2, 0], pred: [0, 2], note: "expect 0 opposite" },
];

for (const c of cases) {
  const acc = calculatePredictionAccuracy(c.pred[0], c.pred[1], c.actual[0], c.actual[1]);
  console.log(
    `${c.actual[0]}-${c.actual[1]} vs ${c.pred[0]}-${c.pred[1]} => ${acc}% (${c.note})`,
  );
}
