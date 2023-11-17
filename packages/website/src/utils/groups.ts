export const getYearFromMainGroup = (main_group: number): number => {
  switch (main_group) {
    case 1:
    case 2:
    case 3:
      return 1;
    case 4:
    case 5:
      return 2;
    case 7:
    case 8:
      return 3;
    default:
      throw new Error(`[getYearFromMainGroup]: Invalid main group (${main_group})`);
  }
};
