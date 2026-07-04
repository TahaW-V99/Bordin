/** جمع سکه‌های گردونه در ۳ روز ÷ ۲ → رند به بالا تا عدد فرد */
export function roundHalfToOdd(half: number) {
  if (half <= 0) return 0;
  const rounded = Math.ceil(half);
  return rounded % 2 === 1 ? rounded : rounded + 1;
}

/** هزینه چرخش سوم: جمع سکه‌های برنده‌شده از گردونه در ۳ روز اخیر، تقسیم بر ۲، رند به عدد فرد */
export function calculateWheelSpinCost(wheelCoinsPerDay: number[]) {
  const sum = wheelCoinsPerDay.reduce((total, amount) => total + amount, 0);
  if (sum <= 0) return 0;
  return roundHalfToOdd(sum / 2);
}
