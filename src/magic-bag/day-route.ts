import type { SchoolData } from "./school-data";

export const MAGIC_BAG_PAGE = "magic-bag-app.html";
const FALLBACK_DAY_PARAM = "magic-bag-day";

type LocationParts = Pick<Location, "pathname" | "search">;

/** Return the data-array index named by the shareable URL, not by UI state. */
export function dayIndexFromUrl(location: LocationParts, days: SchoolData["days"]): number {
  const fallbackWeekday = new URLSearchParams(location.search).get(FALLBACK_DAY_PARAM);
  const pathMatch = location.pathname.match(/\/magic-bag-app\.html\/day\/(\d+)\/?$/);
  const rawWeekday = pathMatch?.[1] ?? fallbackWeekday;
  if (rawWeekday === null || !/^\d+$/.test(rawWeekday)) return -1;

  const weekday = Number(rawWeekday);
  return days.findIndex((day) => day.weekday === weekday);
}

export function dayUrl(baseUrl: string, currentUrl: string, weekday: number): URL {
  const base = new URL(baseUrl, currentUrl);
  return new URL(`${MAGIC_BAG_PAGE}/day/${weekday}`, base);
}

/**
 * GitHub Pages sends clean day paths through 404.html. That page forwards the
 * weekday as a query parameter; restore the shareable path before rendering.
 */
export function restoreForwardedDayPath(
  location: LocationParts,
  baseUrl: string,
  currentUrl: string,
): URL | null {
  const weekday = new URLSearchParams(location.search).get(FALLBACK_DAY_PARAM);
  if (weekday === null || !/^\d+$/.test(weekday)) return null;
  return dayUrl(baseUrl, currentUrl, Number(weekday));
}
