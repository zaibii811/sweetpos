import { useAuth } from "./use-auth";

export type Permission =
  | "pos"
  | "orders"
  | "inventory"
  | "staff"
  | "reports"
  | "settings"
  | "payroll"
  | "void_sale"
  | "delete"
  | "timeclock";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ["pos", "orders", "inventory", "staff", "reports", "settings", "payroll", "void_sale", "delete", "timeclock"],
  admin: ["pos", "orders", "inventory", "staff", "reports", "settings", "payroll", "void_sale", "delete", "timeclock"],
  manager: ["pos", "orders", "inventory", "staff", "reports", "void_sale", "timeclock"],
  cashier: ["pos", "timeclock"],
};

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "cashier";
  const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.cashier;

  function can(permission: Permission): boolean {
    return perms.includes(permission);
  }

  function isOwner(): boolean {
    return role === "owner" || role === "admin";
  }

  function isManagerOrAbove(): boolean {
    return role === "owner" || role === "admin" || role === "manager";
  }

  return { can, role, isOwner, isManagerOrAbove };
}
