/**
 * Returns true if the user is a subadmin (external_role === 'subadmin' OR external_sub_role is set, or userType === SENIOR_MANAGER).
 * Used to hide Projects and other manager-only features from CEO, CTO, Director, VP, CFO, HR, etc.
 */
export function isSubadmin(
  user: {
    external_role?: string | null;
    external_sub_role?: string | null;
    userType?: string;
  } | null | undefined
): boolean {
  if (!user) return false;
  const u = user as { userType?: string; external_role?: string | null; external_sub_role?: string | null };
  if (u.userType === "SENIOR_MANAGER") return true;
  const role = (u.external_role ?? "").toString().trim().toLowerCase();
  if (role === "subadmin") return true;
  const sub = u.external_sub_role;
  return sub != null && sub !== "" && String(sub).trim() !== "";
}
