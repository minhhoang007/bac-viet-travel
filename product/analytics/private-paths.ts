import { appConfig } from "@/config/app";

/**
 * Pages the ad tags never run on: their URLs carry secrets (sign-in `?link=`, password `?token=`, the feedback
 * signature `?s=`, VNPay's signed `vnp_*` return parameters), and GA4/Meta send the full URL with every page view.
 */
const PRIVATE = /^\/(login|verify|security|demo|dashboard|admin|feedback|booking\/return|billing)(\/|$)/;

export function isPrivatePath(pathname: string): boolean {
  const [, first = ""] = pathname.split("/");
  const path = (appConfig.locales as readonly string[]).includes(first) ? pathname.slice(first.length + 1) || "/" : pathname;
  return PRIVATE.test(path);
}
