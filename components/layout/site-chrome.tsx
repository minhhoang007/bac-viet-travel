"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { appConfig } from "@/config/app";

/** Routes that render their own AppShell: the public header, footer and extras would sit around it. */
const APP_SHELL = /^\/(admin|dashboard)(\/|$)/;

export function isAppShellPath(pathname: string): boolean {
  const [, first = ""] = pathname.split("/");
  const path = (appConfig.locales as readonly string[]).includes(first) ? pathname.slice(first.length + 1) || "/" : pathname;
  return APP_SHELL.test(path);
}

/** Renders public site chrome (header, footer, floating buttons) everywhere except AppShell routes. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return isAppShellPath(usePathname()) ? null : children;
}
