import { canViewStore, type AccessSubject } from "./access";

/**
 * What each role may do (spec "Users and roles"). Checked on the server for every
 * mutation; the UI uses the same functions only to decide which buttons to show.
 *
 * Demo decisions (OPEN_QUESTIONS.md):
 *  - Module approval: SuperAdmin only. Regional Managers view and comment until
 *    Sangeetha confirms whether they approve (spec open question).
 *  - Module forms are filled by the store's owner; HQ reviews, approves or rejects.
 */
type StoreRef = { ownerId: string; state: string };

export const can = {
  viewStore: (u: AccessSubject, s: StoreRef) => canViewStore(u, s),
  createStore: (u: AccessSubject) => u.role === "SUPER_ADMIN" || u.role === "STORE_OWNER",
  editStoreMaster: (u: AccessSubject, s: StoreRef) =>
    u.role === "SUPER_ADMIN" || (u.role === "STORE_OWNER" && s.ownerId === u.id),
  editModules: (u: AccessSubject, s: StoreRef) => u.role === "STORE_OWNER" && s.ownerId === u.id,
  uploadFiles: (u: AccessSubject, s: StoreRef) => u.role === "STORE_OWNER" && s.ownerId === u.id,
  approveModules: (u: AccessSubject, s: StoreRef) => u.role === "SUPER_ADMIN" && canViewStore(u, s),
  comment: (u: AccessSubject, s: StoreRef) => canViewStore(u, s),
  overrideStatus: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  assignStores: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  manageUsers: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  manageTemplates: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  viewReports: (u: AccessSubject) => u.role === "SUPER_ADMIN" || u.role === "REGIONAL_MANAGER",
};
