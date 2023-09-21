import type { Fill, Page, Text } from "../converter/pdfparser.js";

export interface FillBounds {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
}

/**
 * @param fill - Fill in the PDF page to get the bounds from
 * @returns - Bounds of the given fill
 */
export const getFillBounds = (fill: Fill): FillBounds => ({
  start_x: fill.x,
  start_y: fill.y,
  end_x: fill.x + fill.w,
  end_y: fill.y + fill.h
});

/**
 * @param page - PDF page
 * @param bounds - Fill bounds to search in
 * @param end_y_offset - Offset to add to the `bounds.end_y` value, useful for getting the next line of text that is somehow just below the bounds.
 * @returns Texts in the given fill bounds.
 */
export const getTextsInFillBounds = (page: Page, bounds: FillBounds, end_y_offset = 0, start_y_offset = 0): Text[] => {
  return page.Texts.filter(text => {
    const x_in_bounds = text.x >= bounds.start_x && text.x <= bounds.end_x;
    const y_in_bounds = text.y >= bounds.start_y && text.y <= (bounds.end_y + end_y_offset);

    return x_in_bounds && y_in_bounds;
  });
}