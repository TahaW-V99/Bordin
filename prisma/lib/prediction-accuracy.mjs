/**
 * Workbook prediction accuracy — mirrored from src/shared/lib/prediction-accuracy.ts
 * for production prisma scripts (plain ESM, no TypeScript).
 */

export function scoreError(predictedHome, predictedAway, actualHome, actualAway) {
  return Math.abs(predictedHome - actualHome) + Math.abs(predictedAway - actualAway);
}

export function marginError(predictedHome, predictedAway, actualHome, actualAway) {
  return Math.abs(predictedHome - predictedAway - (actualHome - actualAway));
}

export function predOutcome(predictedHome, predictedAway) {
  if (predictedHome === predictedAway) return "D";
  if (predictedHome > predictedAway) return "H";
  return "A";
}

export function actualOutcome(actualHome, actualAway) {
  if (actualHome === actualAway) return "D";
  if (actualHome > actualAway) return "H";
  return "A";
}

export function sameOutcome(predictedHome, predictedAway, actualHome, actualAway) {
  return (predictedHome > predictedAway && actualHome > actualAway) ||
    (predictedHome < predictedAway && actualHome < actualAway) ||
    (predictedHome === predictedAway && actualHome === actualAway)
    ? 1
    : 0;
}

export function calculateWorkbookPredictionAccuracy(
  predictedHome,
  predictedAway,
  actualHome,
  actualAway,
) {
  const A2 = predictedHome;
  const B2 = predictedAway;
  const C2 = actualHome;
  const D2 = actualAway;

  const E2 = scoreError(A2, B2, C2, D2);
  const F2 = marginError(A2, B2, C2, D2);
  const G2 = sameOutcome(A2, B2, C2, D2);
  const H2 = predOutcome(A2, B2);
  const I2 = actualOutcome(C2, D2);
  const J2 = C2 + D2;
  const K2 = A2 + B2;

  if (A2 === C2 && B2 === D2) return 100;

  if (I2 === "D" && H2 === "D") {
    if (J2 === 0) {
      if (E2 === 2) return 50;
      if (E2 === 1) return 80;
      if (E2 === 3) return 30;
      return 0;
    }
    if (E2 === 2) return 70;
    if (E2 === 1) return 80;
    if (E2 === 3) return 30;
    return 0;
  }

  if (I2 === "D" && H2 !== "D") {
    if (J2 === 0) {
      if (E2 === 2) return 0;
      if (E2 === 3) return 10;
      return 0;
    }
    if (E2 === 1) return 70;
    if (E2 === 2) {
      if (H2 === "H") return 40;
      if (J2 >= 4) return 40;
      return 30;
    }
    if (E2 === 3) {
      if (H2 === "H") return 20;
      return 10;
    }
    return 0;
  }

  if (I2 !== "D" && H2 === "D") {
    if (E2 === 1) return 70;
    if (E2 === 2) {
      if (J2 >= 4) return 40;
      return 30;
    }
    if (E2 === 3) return 20;
    if (E2 === 4) return 10;
    return 0;
  }

  if (G2 === 1) {
    if (E2 === 1) {
      if (D2 === 0) {
        if (B2 === 0) {
          if (Math.abs(A2 - C2) === 1) return 90;
          return 70;
        }
        if (A2 === C2 && Math.abs(B2 - D2) === 1) return 90;
        return 70;
      }
      if (B2 === D2) return 80;
      if (A2 === C2) {
        if (Math.abs(B2 - D2) === 1) return 90;
        return 80;
      }
      return 80;
    }
    if (E2 === 2) {
      if (D2 === 0) {
        if (B2 === 0) return 70;
        return 70;
      }
      if (B2 === D2) return 80;
      if (D2 > 0 && B2 === 0 && Math.abs(A2 - C2) === 1) return 70;
      if (A2 === C2 && Math.abs(B2 - D2) === 1) {
        if (J2 <= 3) return 70;
        return 80;
      }
      if (Math.abs(A2 - C2) === 1 && Math.abs(B2 - D2) === 1) return 80;
      return 70;
    }
    if (E2 === 3) {
      if (F2 <= 1) {
        if (K2 <= 1) return 50;
        return 60;
      }
      if (F2 >= 3) {
        if (K2 <= 3) return 30;
        return 40;
      }
      return 40;
    }
    if (E2 === 4) {
      if (K2 >= 6) return 30;
      if (J2 >= 5 && K2 <= 1) return 40;
      return 20;
    }
    return 0;
  }

  if (E2 === 1) return 70;
  if (E2 === 2) {
    if (J2 >= 4) return 40;
    return 30;
  }
  if (E2 === 3) {
    if (K2 <= 1) return 20;
    return 30;
  }
  if (E2 === 4) {
    if (K2 <= 1) return 20;
    return 10;
  }
  return 0;
}

export function calculatePredictionAccuracy(
  predictedHome,
  predictedAway,
  actualHome,
  actualAway,
) {
  return calculateWorkbookPredictionAccuracy(predictedHome, predictedAway, actualHome, actualAway);
}

export function bucketAccuracy(raw) {
  const clamped = Math.max(0, Math.min(100, Math.round(raw)));
  if (clamped >= 100) return 100;
  const bucket = Math.floor((clamped + 4) / 10) * 10;
  return Math.min(90, bucket);
}
