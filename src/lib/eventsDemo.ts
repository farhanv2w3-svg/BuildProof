import type { EventRow, EventType, EventStatus } from "../types/database";
import demoPoster from "../assets/demo-event-poster.svg";

/* ------------------------------------------------------------------ */
/*  Demo event — a clearly-labelled FICTIONAL example that teaches     */
/*  what a college event looks like in BuildProof.                     */
/*                                                                     */
/*  Safety rules (mirroring demoData.ts conventions):                  */
/*   * Never written to the database, never uploaded to storage.       */
/*   * Always rendered behind the DemoBadge + "not a real              */
/*     announcement" labels.                                           */
/*   * No real college name, branding or contact details.              */
/*                                                                     */
/*  HOW TO REMOVE THE DEMO EVENT:                                      */
/*   Import of this module exists in exactly two places —              */
/*   src/features/events/EventsPage.tsx (discovery card) and           */
/*   src/features/events/EventDetailPage.tsx (demo detail fallback).   */
/*   Delete the wiring blocks marked "demo event", then delete this    */
/*   file and src/assets/demo-event-poster.svg. No database or         */
/*   storage changes are needed because the demo never touches them.   */
/* ------------------------------------------------------------------ */

/** Fake id — never a real uuid collision risk in practice; URLs from the
 * demo card use this id and are intercepted before any database lookup. */
export const DEMO_EVENT_ID = "demo-inter-college-innovation-hackathon";

export const demoEvent: EventRow = {
  id: DEMO_EVENT_ID,
  created_by: "00000000-0000-0000-0000-000000000000",
  title: "BuildProof Demo — Inter-College Innovation Hackathon",
  event_type: "hackathon" satisfies EventType,
  institution_name: "Example Institute of Technology (Demo)",
  city: "Chennai",
  state_name: "Tamil Nadu",
  start_date: "2027-02-12",
  end_date: "2027-02-13",
  poster_path: "demo-event-poster.svg", // resolved to the bundled asset, not storage
  contact_number: null, // intentionally demonstrates that contact is optional
  venue: "Example campus auditorium (Demo)",
  description:
    "A fictional student hackathon focused on solving practical community, business, and technology problems. Teams of students from different colleges spend one weekend building working prototypes — demo data only.",
  registration_url: null,
  contact_name: null,
  schedule_note: null,
  status: "published" satisfies EventStatus,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

/** The demo poster is a bundled asset — not a storage object. */
export const demoEventPosterUrl = demoPoster;

export function isDemoEvent(id: string | undefined): boolean {
  return id === DEMO_EVENT_ID;
}
