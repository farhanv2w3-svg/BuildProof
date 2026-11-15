import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listEvidence, uploadEvidence, associateEvidence, evidenceDownloadUrl, deleteEvidence, errMessage } from "../../lib/api";
import { Badge, Button, Card, CardHeader, Field, Select, ErrorBanner } from "../../components/ui";
import { validateUpload } from "../../lib/validation";
import { formatDate, titleize } from "../../lib/utils";

const MAX_UPLOAD_BYTES_LABEL = "10 MB";

/**
 * Private-bucket evidence attachments for a team.
 * App enforces file-type/size; storage policies enforce who can see files;
 * access happens through short-lived signed URLs, never permanent public ones.
 */
export function AttachmentsCard({
  teamId,
  userId,
  stage,
  proofCardId,
}: {
  teamId: string;
  userId: string;
  stage: "validation" | "feasibility" | "prototype";
  proofCardId?: string;
}) {
  const { data: attachments, isLoading, error: loadError } = useQuery({
    queryKey: ["evidence", teamId, proofCardId],
    queryFn: () => listEvidence(teamId, undefined, proofCardId),
  });
  const { data: unlinkedAttachments } = useQuery({
    queryKey: ["evidence", teamId, "unlinked"],
    queryFn: () => listEvidence(teamId, undefined, null),
    enabled: !!proofCardId,
  });
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"team" | "reviewers">("reviewers");

  const link = useMutation({
    mutationFn: (evidenceId: string) => associateEvidence(evidenceId, teamId, proofCardId!),
    onSuccess: async () => {
      setErr(null);
      await qc.invalidateQueries({ queryKey: ["evidence", teamId] });
    },
    onError: (e) => setErr(errMessage(e)),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const problem = validateUpload(file);
      if (problem) throw new Error(problem);
      return uploadEvidence(teamId, stage, visibility, userId, file, proofCardId);
    },
    onSuccess: async () => {
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["evidence", teamId] });
    },
    onError: (e) => setErr(errMessage(e)),
  });

  return (
    <Card>
      <CardHeader
        title="Evidence attachments"
        sub="Private storage — team-visible files open to members, reviewer-only files to authorised reviewers, via short-lived signed links."
      />
      <div className="px-5 pb-5">
        {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={`File (max ${MAX_UPLOAD_BYTES_LABEL})`}>
            <input
              type="file"
              className="block w-full max-w-xs text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.xlsx,.txt,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Visible to">
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value as "team" | "reviewers")}>
              <option value="reviewers">Reviewers only</option>
              <option value="team">Whole team</option>
            </Select>
          </Field>
          <Button loading={upload.isPending} disabled={!file} onClick={() => upload.mutate()}>
            Upload
          </Button>
        </div>

        {loadError && <div className="mt-3"><ErrorBanner message={errMessage(loadError)} /></div>}
        {isLoading && <p className="mt-3 text-[12.5px] text-ink-soft">Loading evidence…</p>}
        {!!proofCardId && (unlinkedAttachments ?? []).length > 0 && (
          <div className="mt-4 rounded-lg border border-line bg-canvas p-3">
            <p className="text-[12px] font-bold text-ink">Link existing evidence to this Proof Card</p>
            <div className="mt-2 space-y-2">
              {(unlinkedAttachments ?? []).map((attachment) => (
                <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span>{attachment.file_name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={link.isPending}
                    onClick={() => link.mutate(attachment.id)}
                  >
                    Link to card
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {(attachments ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]"
            >
              <div>
                <p className="font-semibold">{a.file_name}</p>
                <p className="text-[11.5px] text-ink-soft">
                  {titleize(a.stage)} · {a.visibility === "team" ? "team visible" : "reviewers only"} ·{" "}
                  {Math.round(a.size_bytes / 1024)} KB · {formatDate(a.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyId === a.id}
                  onClick={async () => {
                    setBusyId(a.id);
                    try {
                      const url = await evidenceDownloadUrl(a.file_path);
                      window.open(url, "_blank", "noopener");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  Open
                </Button>
                <button
                  className="text-[12px] font-semibold text-danger hover:underline"
                  onClick={async () => {
                    try {
                      await deleteEvidence(a.file_path, a.id);
                      await qc.invalidateQueries({ queryKey: ["evidence", teamId] });
                    } catch (e) {
                      setErr(errMessage(e));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!isLoading && (attachments ?? []).length === 0 && (
          <p className="mt-3 text-[12.5px] text-ink-soft">
            No attachments yet. Photos of the problem, consented interview recordings or transcripts, and test materials all count as evidence.
          </p>
        )}
      </div>
    </Card>
  );
}

export function StageStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="font-display text-xl font-extrabold">{value}</p>
      {note && <p className="text-[11.5px] text-ink-soft">{note}</p>}
    </div>
  );
}

export function ReviewBadge({ status }: { status: string }) {
  const tone =
    status === "reviewed" ? "success" : status === "submitted" ? "brand" : "neutral";
  return <Badge tone={tone as "success" | "brand" | "neutral"}>{titleize(status)}</Badge>;
}
