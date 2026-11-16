-- ============================================================================
-- BuildProof — 0018_eventspace_showcase_grant.sql  (additive; one privilege)
--
-- Found in practical post-deploy testing (2026-11-16): the public showcase
-- page (/eventspace/:slug/showcase) failed for anonymous visitors with
-- "permission denied for table es_showcases".
--
-- Cause: es_public_showcases is created WITH (security_invoker = true), so a
-- caller needs SELECT on the underlying tables. anon had SELECT on es_events
-- (0017) but not on es_showcases.
--
-- Safe: es_showcases has the RLS policy "public read published showcases"
-- (anon), limiting anon rows to published showcases of visible events.
-- ============================================================================

grant select on public.es_showcases to anon;
