import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button, Card, CardHeader, ErrorBanner, LoadingBlock, PageTitle } from "../components/ui";
import { getNotificationPreferences, saveNotificationPreferences } from "../lib/api";
import type { NotificationPreferences } from "../types/database";
import { pushSupported, registerBuildProofServiceWorker, urlBase64ToUint8Array } from "../lib/notificationPush";
import { savePushSubscription, disablePushSubscription } from "../lib/api";

const defaults: Omit<NotificationPreferences, "user_id" | "updated_at"> = {
  in_app_enabled: true,
  push_enabled: false,
  feature_announcements: true,
  team_notifications: true,
  project_notifications: true,
  event_notifications: true,
};

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getNotificationPreferences().then((stored) => {
      if (stored) {
        const { in_app_enabled, push_enabled, feature_announcements, team_notifications, project_notifications, event_notifications } = stored;
        setPreferences({ in_app_enabled, push_enabled, feature_announcements, team_notifications, project_notifications, event_notifications });
      }
      setLoading(false);
    }).catch(() => {
      setError("Preferences could not be loaded.");
      setLoading(false);
    });
  }, []);

  const toggle = (key: keyof typeof defaults) => setPreferences((current) => ({ ...current, [key]: !current[key] }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveNotificationPreferences(preferences);
    } catch {
      setError("Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setError(null);
    if (!pushSupported()) {
      setError("Browser push is not supported by this browser or installation.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPreferences((current) => ({ ...current, push_enabled: false }));
      setError("Notification permission was not granted. You can enable it later in browser settings.");
      return;
    }
    const registration = await registerBuildProofServiceWorker();
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!registration || !publicKey) {
      setError("Push setup is not available until the site administrator configures VAPID.");
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
    await savePushSubscription(subscription.toJSON());
    setPreferences((current) => ({ ...current, push_enabled: true }));
  }

  async function disablePush() {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await disablePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setPreferences((current) => ({ ...current, push_enabled: false }));
  }

  if (loading) return <LoadingBlock label="Loading notification preferences…" />;

  const checkbox = (key: keyof typeof defaults, title: string, description: string) => (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-4">
      <input type="checkbox" checked={Boolean(preferences[key])} onChange={() => toggle(key)} />
      <span><span className="block font-semibold">{title}</span><span className="text-[13px] text-ink-soft">{description}</span></span>
    </label>
  );

  return (
    <div>
      <PageTitle title="Notification preferences" sub="Choose which optional BuildProof updates you receive." />
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardHeader title="Delivery and categories" />
        <div className="space-y-3 px-5 pb-5">
          {checkbox("in_app_enabled", "In-app notifications", "Show notifications in the BuildProof notification centre.")}
          {checkbox("feature_announcements", "New feature announcements", "Receive announcements manually published by BuildProof administrators.")}
          {checkbox("team_notifications", "Team notifications", "Invitations and team activity.")}
          {checkbox("project_notifications", "Projects and problems", "Relevant project, problem and Proof Card updates.")}
          {checkbox("event_notifications", "Events", "Relevant BuildProof event announcements.")}
          <div className="rounded-lg border border-line p-4">
            <div className="flex items-start gap-3">
              <BellRing className="mt-1 h-5 w-5" />
              <div className="flex-1">
                <p className="font-semibold">Browser push notifications</p>
                <p className="text-[13px] text-ink-soft">Push only works in supported browsers. Mobile support varies; eligible installed iOS web apps must request permission after you choose to enable it.</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={!pushSupported() || preferences.push_enabled} onClick={enablePush}>Enable push</Button>
                  <Button size="sm" variant="secondary" disabled={!preferences.push_enabled} onClick={disablePush}>Disable push</Button>
                </div>
              </div>
            </div>
          </div>
          <Button loading={saving} onClick={save}>Save preferences</Button>
        </div>
      </Card>
    </div>
  );
}
