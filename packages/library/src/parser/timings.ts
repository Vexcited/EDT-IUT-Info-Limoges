import type { Page } from "../converter/types";

import { type FillBounds, getFillBounds, getTextsInFillBounds } from "./bounds";
import { COLORS } from "./constants";

export const getTimetableTimings = (page: Page, header_bounds: FillBounds): Record<string, string> => {
  // We get the fills for the timing that are just below the header.
  const timing_fills = page.Fills.filter(fill => fill.oc === COLORS.RULERS && fill.y === header_bounds.end_y);
  const timingsFromX: Record<string, string> = {};
    
  for (const fill of timing_fills) {
    const bounds = getFillBounds(fill);
    const texts = getTextsInFillBounds(page, bounds);
    
    const text = texts[0]?.R?.[0]?.T;
    if (!text) continue;

    timingsFromX[fill.x] = decodeURIComponent(text).trim()
  }

  return timingsFromX;
};
