/**
 * @param value - The value to round
 * @param decimals - The number of decimals to round to. Defaults to 2.
 * @returns Rounded value.
 */
export const round = (value: number, decimals = 2): number => {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
};
