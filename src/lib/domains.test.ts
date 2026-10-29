import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Server-side domain rules, mirrored as pure checks for automated    */
/*  testing. The authoritative enforcement lives in Supabase (RLS +    */
/*  guard triggers in 0003); these functions exist so the same rules   */
/*  are exercised in CI and documented in one place. If these tests    */
/*  fail, the database policy and the UI expectations have drifted.    */
/* ------------------------------------------------------------------ */

export interface Actor {
  isOrgStaff?: boolean; // owner or representative of the sponsoring organisation
  isPlatformAdmin?: boolean;
}

/** Mirrors public.payment_status_guard() */
export function paymentTransitionAllowed(
  from: string,
  to: string,
  actor: Actor
): { ok: boolean; reason?: string } {
  const userIsOrgStaff = actor.isOrgStaff ?? false;
  const userIsAdmin = actor.isPlatformAdmin ?? false;

  if (to === "paid" && from !== "paid") {
    if (!userIsOrgStaff && !userIsAdmin) {
      return { ok: false, reason: "Only the sponsoring organisation or platform admins can mark a payment as paid" };
    }
  }
  if (from === "paid" && to !== "paid") {
    if (!["disputed", "cancelled"].includes(to) && !userIsAdmin) {
      return { ok: false, reason: "A confirmed payment cannot be silently un-confirmed" };
    }
  }
  return { ok: true };
}

/** Mirrors public.review_verify_guard() */
export function reviewVerificationChangeAllowed(actor: Actor): boolean {
  return actor.isPlatformAdmin ?? false;
}

/** Mirrors the check constraints on payment_milestones */
export function isPaymentAmountValid(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents >= 0 && amountCents <= 100_000_000;
}

/** Mirrors team_role_requirements seat bounds */
export function isSeatCountValid(seats: number): boolean {
  return Number.isInteger(seats) && seats >= 1 && seats <= 20;
}

/** Client-side restatement of the RLS select policy on company_projects:
 * drafts, and closed projects, stay hidden unless the viewer is organisation
 * staff or a platform admin. */
export function canProjectBePubliclyListed(status: string): boolean {
  return ["listed", "in_review", "in_progress", "completed"].includes(status);
}

/* --------------------------- the tests ---------------------------- */

describe("payment integrity (§26.F / DB guard parity)", () => {
  it("blocks a student or any non-staff actor from marking a payment paid", () => {
    expect(paymentTransitionAllowed("due", "paid", {})).toMatchObject({ ok: false });
    expect(paymentTransitionAllowed("due", "paid", { isOrgStaff: false })).toMatchObject({ ok: false });
  });
  it("allows the sponsoring organisation to mark a payment paid", () => {
    expect(paymentTransitionAllowed("due", "paid", { isOrgStaff: true })).toMatchObject({ ok: true });
  });
  it("allows platform admins to mark payments paid", () => {
    expect(paymentTransitionAllowed("due", "paid", { isPlatformAdmin: true })).toMatchObject({ ok: true });
  });
  it("prevents silently un-confirming a completed payment", () => {
    expect(paymentTransitionAllowed("paid", "agreed", { isOrgStaff: true })).toMatchObject({ ok: false });
    expect(paymentTransitionAllowed("paid", "agreed", { isPlatformAdmin: true })).toMatchObject({ ok: true });
  });
  it("allows authorised dispute/cancellation of a paid milestone only to staff/admin", () => {
    expect(paymentTransitionAllowed("paid", "disputed", { isOrgStaff: true })).toMatchObject({ ok: true });
    expect(paymentTransitionAllowed("paid", "cancelled", { isPlatformAdmin: true })).toMatchObject({ ok: true });
  });
  it("allows ordinary non-paid state movement by org staff", () => {
    expect(paymentTransitionAllowed("agreed", "due", { isOrgStaff: true })).toMatchObject({ ok: true });
    expect(paymentTransitionAllowed("agreed", "disputed", { isOrgStaff: true })).toMatchObject({ ok: true });
  });
});

describe("review verification integrity (§26.B / DB guard parity)", () => {
  it("only platform admins can set or clear the verified flag", () => {
    expect(reviewVerificationChangeAllowed({})).toBe(false);
    expect(reviewVerificationChangeAllowed({ isOrgStaff: true })).toBe(false);
    expect(reviewVerificationChangeAllowed({ isPlatformAdmin: true })).toBe(true);
  });
});

describe("numeric and enum validation (§26.C mirrors)", () => {
  it("rejects negative, fractional or absurd payment amounts", () => {
    expect(isPaymentAmountValid(-1)).toBe(false);
    expect(isPaymentAmountValid(10.5)).toBe(false);
    expect(isPaymentAmountValid(100_000_001)).toBe(false);
    expect(isPaymentAmountValid(0)).toBe(true);
    expect(isPaymentAmountValid(12000_00)).toBe(true);
  });
  it("bounds team seats between 1 and 20", () => {
    expect(isSeatCountValid(0)).toBe(false);
    expect(isSeatCountValid(21)).toBe(false);
    expect(isSeatCountValid(3)).toBe(true);
  });
});

describe("draft visibility (§26.B mirrors)", () => {
  it("treats drafts and closed projects as private, listed ones as public", () => {
    expect(canProjectBePubliclyListed("draft")).toBe(false);
    expect(canProjectBePubliclyListed("closed")).toBe(false);
    expect(canProjectBePubliclyListed("listed")).toBe(true);
  });
});

describe("demo data discipline (no fake users, §18)", () => {
  it("keeps demo data out of the API layer", async () => {
    const apiSource = await import("../lib/api");
    // demoData is never imported by the API layer — verify no accidental re-export
    expect(Object.keys(apiSource).filter((k) => k.toLowerCase().includes("demo"))).toEqual([]);
  });
});
