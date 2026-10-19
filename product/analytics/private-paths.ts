import { appConfig } from "@/config/app";

/**
 * Pages the ad tags never run on: sign-in, password and account pages carry one-time links and tokens in the URL
 * (`?link=`, `?token=`), and GA4/Meta send the full URL with every page view.
 */
const PRIVATE = /^\/(login|verify|security|demo|dashboard|admin)(\/|$)/;

export function isPrivatePath(pathname: string): boolean {
  const [, first = ""] = pathname.split("/");
  const path = (appConfig.locales as readonly string[]).includes(first) ? pathname.slice(first.length + 1) || "/" : pathname;
  return PRIVATE.test(path);
}
