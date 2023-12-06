export const safelyGetInLocalStorage = (key: string, default_value: string): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key) ?? default_value;
  }

  // only happens server-side.
  return default_value;
};