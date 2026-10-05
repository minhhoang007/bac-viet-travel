import { cookies } from "next/headers";

/** Sidebar open state saved by components/ui/sidebar.tsx (cookie `sidebar_state`); open unless closed before. */
export async function sidebarDefaultOpen(): Promise<boolean> {
  return (await cookies()).get("sidebar_state")?.value !== "false";
}
