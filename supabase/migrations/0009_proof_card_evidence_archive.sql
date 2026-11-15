-- Proof Card evidence linkage and archive support
-- DRAFT: review and apply manually. Existing evidence remains team-scoped until
-- an authorised uploader explicitly associates it with a Proof Card.

alter table public.proof_cards
  add column if not exists archived boolean not null default false;

create index if not exists proof_cards_active_idx
  on public.proof_cards (archived, visibility, review_status);

alter table public.evidence_attachments
  add column if not exists proof_card_id uuid references public.proof_cards (id) on delete set null;

create index if not exists evidence_proof_card_idx
  on public.evidence_attachments (proof_card_id);

create or replace function public.validate_evidence_proof_card()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.proof_card_id is not null then
    if not exists (
      select 1 from public.proof_cards pc
      where pc.id = new.proof_card_id
        and pc.team_id = new.team_id
        and pc.archived = false
    ) then
      raise exception 'proof_card_id must reference an active card owned by the evidence team';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_evidence_proof_card() from public;
drop trigger if exists evidence_proof_card_consistency on public.evidence_attachments;
create trigger evidence_proof_card_consistency
before insert or update of team_id, proof_card_id on public.evidence_attachments
for each row execute function public.validate_evidence_proof_card();

-- Archived cards must never appear in public discovery or public detail access.
drop policy if exists "public read published cards" on public.proof_cards;
create policy "public read published cards" on public.proof_cards
for select to anon
using (
  archived = false
  and visibility = 'public'
  and review_status in ('approved', 'published')
);

-- Signed-in public-card access also excludes archived cards.
drop policy if exists "authorised readers view proof cards" on public.proof_cards;
create policy "authorised readers view proof cards" on public.proof_cards
for select to authenticated
using (
  public.can_read_team(team_id)
  or (
    archived = false
    and visibility = 'public'
    and review_status in ('approved', 'published')
  )
);

-- Card skills have their own anonymous policy; archived cards must also be
-- excluded from this public relationship.
drop policy if exists "anon read published card skills" on public.proof_card_skills;
create policy "anon read published card skills" on public.proof_card_skills
for select to anon
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = proof_card_skills.card_id
    and pc.archived = false
    and pc.visibility = 'public'
    and pc.review_status in ('approved', 'published')
));

-- Evidence remains private and team-scoped. Card-linked evidence additionally
-- requires the card and attachment team to match (enforced above).
drop policy if exists "uploaders & staff manage attachments" on public.evidence_attachments;
create policy "uploaders & staff manage attachments" on public.evidence_attachments
for update to authenticated
using (
  uploaded_by = auth.uid()
  or public.can_edit_team_work(team_id)
  or public.can_review_team_work(team_id)
)
with check (
  uploaded_by = auth.uid()
  or public.can_edit_team_work(team_id)
  or public.can_review_team_work(team_id)
);

drop policy if exists "authorised readers view attachments" on public.evidence_attachments;
create policy "authorised readers view attachments" on public.evidence_attachments
for select to authenticated
using (
  public.can_review_team_work(team_id)
  or (visibility = 'team' and public.can_read_team(team_id))
  or (uploaded_by = auth.uid())
);

drop policy if exists "team members attach evidence" on public.evidence_attachments;
create policy "team members attach evidence" on public.evidence_attachments
for insert to authenticated
with check (
  public.is_team_member(team_id)
  and (
    proof_card_id is null
    or exists (
      select 1 from public.proof_cards pc
      where pc.id = proof_card_id
        and pc.team_id = evidence_attachments.team_id
        and pc.archived = false
    )
  )
);

-- Private evidence storage reads must follow attachment visibility too. Team
-- members may read team-visible files; only uploaders and authorised reviewers
-- may read reviewer-only files. Card linkage does not make evidence public.
drop policy if exists "team readers read evidence objects" on storage.objects;
create policy "team readers read evidence objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'evidence'
  and exists (
    select 1 from public.evidence_attachments ea
    where ea.file_path = storage.objects.name
      and ea.team_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and (
        ea.uploaded_by = auth.uid()
        or public.can_review_team_work(ea.team_id)
        or (ea.visibility = 'team' and public.can_read_team(ea.team_id))
      )
  )
);

-- Public discovery needs table privileges as well as matching RLS policies.
-- Private evidence and evidence objects are deliberately not granted to anon.
revoke insert, update, delete, truncate, references, trigger on public.proof_cards from anon;
revoke insert, update, delete, truncate, references, trigger on public.proof_card_skills from anon;
grant select on public.proof_cards to anon;
grant select on public.proof_card_skills to anon;

-- Archiving uses the existing Proof Card update policy; there is no delete path.
-- updateCard only can reach this table through RLS, and existing policies retain
-- team-editor and authorised-reviewer permissions.
