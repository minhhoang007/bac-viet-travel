"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireFreshSecondFactor } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import { isStaffRole } from "@/product/staff/permissions";

const locale = z.enum(["vi", "en"]).catch("vi");
const EVENT = "staff_admin.action_failed";

/** Admins only: run `work`, then back to /admin/staff with result=<outcome>. */
async function staffAction(formData: FormData, work: (ctx: Awaited<ReturnType<typeof requireAdmin>>) => Promise<string>): Promise<never> {
  const ctx = await requireAdmin();
  // Who may do what: verify again if the last second factor is older than a few minutes.
  await requireFreshSecondFactor("/admin/staff");
  let result = "failed";
  try {
    result = await work(ctx);
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn(EVENT, { error });
  }
  redirect(localePath(locale.parse(formData.get("locale")), `/admin/staff?result=${result}`));
}

/**
 * Give an account a staff role. Booking pages need the starter's editor level to open the admin area, so a plain user
 * is raised to editor (audited by the admin module); the staff role itself is audited by the product. With password
 * sign-in on, an address without an account is invited: the account is created and emailed a link to set a password
 * (sent after the role, as only staff receive it).
 */
export async function setStaffRole(formData: FormData): Promise<void> {
  await staffAction(formData, async ({ admin, container, user: actor }) => {
    const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
    const role = formData.get("role");
    if (!email.success || !isStaffRole(role)) return "invalid";
    const auth = container.app!.auth;
    let found = (await admin.listUsers({ query: email.data, pageSize: 10 })).rows.find((u) => u.email.toLowerCase() === email.data);
    const invite = !found && auth.methods.password;
    if (invite) found = (await admin.getUser(await auth.ensureAccount(email.data))) ?? undefined;
    if (!found) return "not_found";
    if (found.role === "admin") return "is_admin";
    // Disabled (removed staff, or an admin's decision on the users page): enabling it again is a decision too.
    if (found.status === "disabled") return "disabled";
    // Staff role first, then the editor level that opens the admin area: a failure in between leaves no access.
    await container.app!.product.staff.set(actor, found.id, role);
    if (found.role === "user") await admin.setUserRole(actor, found.id, "editor");
    if (!invite) return "done";
    return (await sendSetup(auth, found.email, container.logger)) ? "invited" : "mail_failed";
  });
}

/** The email with a link to set a password (it replaces unused links; the old password works until a new one is saved). Admins only. */
export async function sendStaffPasswordLink(formData: FormData): Promise<void> {
  await staffAction(formData, async ({ admin, container, user: actor }) => {
    const userId = z.uuid().safeParse(formData.get("userId"));
    if (!userId.success) return "invalid";
    const target = await admin.getUser(userId.data);
    if (!target) return "invalid";
    // Only active staff get password links (the auth service sends nothing to anyone else).
    if (target.role === "user" || target.status === "disabled") return "not_staff";
    if (!(await sendSetup(container.app!.auth, target.email, container.logger))) return "mail_failed";
    await admin.audited(actor, { action: "staff.password_link", targetType: "user", targetId: target.id }, async () => true);
    return "link_sent";
  });
}

type Ctx = Awaited<ReturnType<typeof requireAdmin>>["container"];

// A mail outage leaves the account and role in place: the admin sends the link again later.
async function sendSetup(auth: NonNullable<Ctx["app"]>["auth"], email: string, logger: Ctx["logger"]): Promise<boolean> {
  try {
    await auth.sendPasswordSetup(email);
    return true;
  } catch (error) {
    logger.warn(EVENT, { error });
    return false;
  }
}

/**
 * Offboarding: the account is disabled first (every session ends; password, passkeys and codes stop working), then
 * the editor level and the staff role are removed. A failure in between leaves no access. To take the person back, an
 * admin enables the account (users page), then adds the role.
 */
export async function removeStaff(formData: FormData): Promise<void> {
  await staffAction(formData, async ({ admin, container, user: actor }) => {
    const userId = z.uuid().safeParse(formData.get("userId"));
    if (!userId.success) return "invalid";
    const target = await admin.getUser(userId.data);
    if (target && target.role !== "admin") await admin.setUserStatus(actor, userId.data, "disabled");
    await container.app!.auth.dropPasswordLinks(userId.data);
    if (target?.role === "editor") await admin.setUserRole(actor, userId.data, "user");
    await container.app!.product.staff.set(actor, userId.data, null);
    return "done";
  });
}
