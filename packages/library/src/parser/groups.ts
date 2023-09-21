import type { Page } from "../converter";

import { type FillBounds, getFillBounds, getTextsInFillBounds } from "./bounds";
import { COLORS, DAYS, SUBGROUPS } from "./constants";
import { round } from "../utils/numbers";

export interface TimetableGroup {
  /**
   * Main group value.
   * For example, if you're in G1A, the main group value is `1`. 
   */
  main: number;
  
  /**
   * Subgroup value. Where `0` is **A** and `1` is **B**.
   * For example, if you're in G1A, the subgroup value is `0`.
   */
  sub: SUBGROUPS;
  
  /**
   * Index of the day in the week, starting from `0`
   * for **Monday** to `5` for **Saturday**.
   */
  day_index: typeof DAYS[keyof typeof DAYS];
}

export const getTimetableGroups = (page: Page, header_bounds: FillBounds): Record<string, TimetableGroup> => {
  const days = page.Fills.filter(fill => fill.oc === COLORS.RULERS && fill.x > header_bounds.start_x);
  const groupsFromY: Record<string, TimetableGroup> = {};

  for (const fill of days) {
    const bounds = getFillBounds(fill);
    const texts = getTextsInFillBounds(page, bounds);
    
    const raw_day = texts[0]?.R?.[0]?.T;
    if (!raw_day) continue;

    const day_index = DAYS[decodeURIComponent(raw_day).trim() as keyof typeof DAYS];

    const groups = page.Fills.filter(fill => {
      const isGroupColor = fill.oc === COLORS.RULERS;
      const startsAtDayEndXBound = fill.x === bounds.end_x;
      const isWithinDayBounds = fill.y >= bounds.start_y && fill.y <= bounds.end_y;
    
      return isGroupColor && startsAtDayEndXBound && isWithinDayBounds;
    });

    

    for (const fill of groups) {
      const bounds = getFillBounds(fill);
      const texts = getTextsInFillBounds(page, bounds);
      
      const group_text = texts[0]?.R?.[0]?.T;
      if (!group_text) continue;

      const main_group_name = parseInt(decodeURIComponent(group_text).trim()[1]);

      // We round since we're doing the difference between two floats (may be incorrect)
      const startYForGroupA = round(bounds.start_y).toString();
      const startYForGroupB = round(fill.y + (fill.h / 2)).toString();

      const group: Omit<TimetableGroup, "sub"> = {
        main: main_group_name,
        day_index
      };

      groupsFromY[startYForGroupA] = {
        ...group,
        sub: SUBGROUPS.A
      };

      groupsFromY[startYForGroupB] = {
        ...group,
        sub: SUBGROUPS.B
      };
    }
  }

  return groupsFromY;
};
