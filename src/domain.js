/**
 * Business rules that must hold no matter what the browser sends.
 *
 * The frontend enforces the same rules for a good experience; these are the
 * ones that actually count, because anyone can call the API with curl.
 */
import { randomUUID } from "node:crypto";
import { getConfig } from "./db.js";

export const isManager = user => !!user && user.role === "manager";

const statusKind = (cfg, id) => (cfg.statuses.find(s => s.id === id) || { kind: "open" }).kind;
export const isClosedStatus = (cfg, id) => statusKind(cfg, id) === "done";

/* ------------------------------------------------------------ permissions */

/** Who may change a task at all. Employees own their own work. */
export function canEditTask(user, stored) {
  if (!user) return false;
  if (isManager(user)) return true;
  if (!stored) return true;                              // creating their own
  return stored.assigneeId === user.id || stored.createdById === user.id;
}
/** Who may mark it done — the person doing the work, or a manager. */
export function canCompleteTask(user, stored) {
  if (!user) return false;
  return isManager(user) || (stored && stored.assigneeId === user.id);
}

/** Fields only a manager may set. Employees keep the stored value. */
export const MANAGER_ONLY_FIELDS = ["assigneeId", "dueDate", "departmentId", "teamId"];

/**
 * Fold an incoming task onto the stored one, dropping anything this user is
 * not allowed to change. Returns the task to persist plus a list of fields
 * that were silently held back, so the API can tell the caller.
 */
export function applyFieldPermissions(user, incoming, stored) {
  const out = { ...incoming };
  const denied = [];
  if (!stored) {
    // On create, an employee may only assign work to themselves.
    if (!isManager(user) && out.assigneeId && out.assigneeId !== user.id) {
      out.assigneeId = user.id;
      denied.push("assigneeId");
    }
    out.createdById = user.id;
    return { task: out, denied };
  }
  out.createdById = stored.createdById;                  // never rewritable
  out.createdAt = stored.createdAt;
  if (!isManager(user)) {
    for (const f of MANAGER_ONLY_FIELDS) {
      const a = stored[f] ?? null, b = out[f] ?? null;
      if (String(a) !== String(b)) { out[f] = stored[f]; denied.push(f); }
    }
    if (out.status === "COMPLETED" && stored.status !== "COMPLETED" && !canCompleteTask(user, stored)) {
      out.status = stored.status; out.progress = stored.progress; out.completedAt = stored.completedAt;
      denied.push("status");
    }
  }
  return { task: out, denied };
}

/* ------------------------------------------------------------- validation */

/** Mirrors the client-side rules. Returns { field: message }. */
export function validateTask(t) {
  const cfg = getConfig();
  const errs = {};
  const d = s => { if (!s) return null; const x = new Date(String(s).length === 10 ? s + "T00:00:00Z" : s); return isNaN(x) ? null : x; };

  if (!t.title || !String(t.title).trim()) errs.title = "A task needs a title.";
  if (String(t.title || "").length > 300) errs.title = "Title is too long (300 characters max).";
  if (!t.assigneeId) errs.assigneeId = "Assign this to someone.";
  if (!cfg.priorities.some(p => p.id === t.priority)) errs.priority = "Unknown priority.";
  if (!cfg.statuses.some(s => s.id === t.status)) errs.status = "Unknown status.";

  const p = Number(t.progress);
  if (isNaN(p) || p < 0 || p > 100) errs.progress = "Progress must be between 0 and 100.";

  const sd = d(t.startDate), dd = d(t.dueDate), ed = d(t.expectedCompletion);
  if (sd && dd && dd < sd) errs.dueDate = "Due date cannot be before the start date.";
  if (sd && ed && ed < sd) errs.expectedCompletion = "Expected completion cannot be before the start date.";

  if (t.status === "COMPLETED") {
    if (p !== 100) errs.progress = "A completed task must be at 100%.";
    if (!t.completedAt) errs.completedAt = "A completed task needs a completion date.";
  }
  if (t.priority === "CRITICAL" && !t.expectedCompletion) errs.expectedCompletion = "Critical tasks need an expected completion date.";
  if (t.status === "BLOCKED" && !(t.blocker && String(t.blocker.reason || "").trim())) errs.blocker = "Explain what is blocking this task.";
  for (const f of ["estimatedHours", "actualHours"]) {
    if (t[f] != null && t[f] !== "" && (isNaN(Number(t[f])) || Number(t[f]) < 0)) errs[f] = "Effort cannot be negative.";
  }
  return errs;
}

/* --------------------------------------------------------------- activity */

export const FIELD_LABELS = {
  title: "Title", description: "Description", assigneeId: "Assignee", priority: "Priority",
  status: "Status", progress: "Progress", dueDate: "Due date", startDate: "Start date",
  expectedCompletion: "Expected completion", estimatedHours: "Estimated effort",
  actualHours: "Actual effort", projectId: "Project", category: "Category",
  departmentId: "Department", teamId: "Team", tags: "Tags"
};

const entry = (user, kind, field, from, to, note) => ({
  id: randomUUID(), at: new Date().toISOString(),
  byId: user ? user.id : null, byName: user ? user.name : "System",
  kind, field: field || null, from: from ?? null, to: to ?? null, note: note || null
});

/**
 * The audit trail is derived here, not accepted from the client — otherwise
 * the history could be written to say anything.
 */
export function diffActivity(user, stored, next) {
  if (!stored) return [entry(user, "create", null, null, null, "Task created")];
  const out = [];
  for (const k of Object.keys(FIELD_LABELS)) {
    const a = Array.isArray(stored[k]) ? stored[k].join(", ") : stored[k];
    const b = Array.isArray(next[k]) ? next[k].join(", ") : next[k];
    if ((a ?? "") === (b ?? "")) continue;
    let kind = "edit";
    if (k === "priority") kind = "priority";
    else if (k === "status") kind = b === "COMPLETED" ? "complete" : b === "BLOCKED" ? "block" : "status";
    else if (k === "assigneeId") kind = stored.assigneeId ? "reassign" : "assign";
    else if (k === "dueDate") kind = "due";
    else if (k === "progress") kind = "progress";
    out.push(entry(user, kind, k, a, b));
  }
  const wasBlocked = !!(stored.blocker && stored.blocker.reason && !stored.blocker.resolvedAt);
  const isBlocked = !!(next.blocker && next.blocker.reason && !next.blocker.resolvedAt);
  if (!wasBlocked && isBlocked) {
    out.push(entry(user, "block", null, null, null,
      "Blocker: " + next.blocker.reason + (next.blocker.needsManager ? " (manager intervention requested)" : "")));
  } else if (wasBlocked && !isBlocked) {
    out.push(entry(user, "unblock", null, null, null, "Blocker resolved"));
  }
  if ((next.reopenCount || 0) > (stored.reopenCount || 0)) {
    out.push(entry(user, "reopen", null, null, null, "Task reopened after completion"));
  }
  return out;
}
export const noteEntry = (user, kind, note) => entry(user, kind, null, null, null, note);
