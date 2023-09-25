/**
 * @returns - In format "(H)H" + "h" + ("(m)m" if not 0) 
 */
export const hoursAndMinutesBetween = (timeEnd: Date, timeStart: Date): string => {
  const hourDiff = timeEnd.getTime() - timeStart.getTime();
  const minDiff = hourDiff / 60 / 1000;
  const hDiff = hourDiff / 3600 / 1000;
  
  const output = {
    hours: Math.floor(hDiff),
    minutes: 0
  };

  output.minutes = minDiff - 60 * output.hours;
  return output.hours + "h" + (output.minutes ? output.minutes : "");
};
