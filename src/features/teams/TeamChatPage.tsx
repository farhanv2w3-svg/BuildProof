import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { listTeamMessages, sendTeamMessage } from "../../lib/api";
import type { TeamMessage } from "../../types/database";
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, Textarea } from "../../components/ui";

export default function TeamChatPage() {
  const { team } = useOutletContext<{ team: { id: string; name: string } }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setMessages(await listTeamMessages(team.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load team chat.");
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

  if (loading) return <LoadingBlock />;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4">
        <h1 className="display-title text-xl">Team chat</h1>
        <p className="mt-1 text-[13px] text-ink-soft">Private discussion for accepted members of {team.name}. Messages are stored securely and are not visible outside this team.</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="max-h-[420px] min-h-48 space-y-2 overflow-y-auto rounded-lg border border-line bg-surface-muted p-3" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState title="Start the conversation" description="Share progress, questions or decisions with your team." />
        ) : messages.map((message) => (
          <div key={message.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${message.sender_id === user?.id ? "ml-auto bg-brand-50 text-brand-900" : "bg-white text-ink"}`}>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <time className="mt-1 block text-[10px] text-ink-soft" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const message = body.trim();
        if (!message || !user) return;
        setSending(true);
        setError(null);
        try {
          await sendTeamMessage(team.id, user.id, message);
          setBody("");
          await refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not send message.");
        } finally {
          setSending(false);
        }
      }}>
        <Textarea aria-label="Message" value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={4000} placeholder="Write a team message…" required />
        <Button type="submit" loading={sending} disabled={!body.trim()} className="self-end">Send</Button>
      </form>
    </Card>
  );
}
