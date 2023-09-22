/**
 * Colors we'll use to extract data from the PDF.
 * Since they're constant, we can easily use them to extract the data we want.
 */
export const COLORS = {
  CM: "#ffff0c",
  TD: "#ffbab3",
  TP: "#b3ffff",
  SAE: "#9fff9f",

  RULERS: "#ffffa7",
  HEADER: "#64ccff"
}

/**
 * Days are hardcoded in the PDF.
 * Since we can't really find the day index from the PDF,
 * we just hardcode it in this enumeration.
 * 
 * Should be used with a **+1** offset in `luxon.DateTime` since 0 means Sunday for them.
 */
export const DAYS = {
  LUNDI: 0,
  MARDI: 1,
  MERCREDI: 2,
  JEUDI: 3,
  VENDREDI: 4,
  SAMEDI: 5
};

/**
 * To differentiate between the two subgroups.
 */
export enum SUBGROUPS {
  A = 0,
  B = 1
}

export enum LESSON_TYPES {
  CM = "CM",
  TD = "TD",
  TP = "TP",
  SAE = "SAE"
}
