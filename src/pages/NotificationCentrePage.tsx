import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, CardHeader, EmptyState, ErrorBanner, LoadingBlock, PageTitle } from "../components/ui";
import { listNotificationsPage, markAllNotificationsRead, markNotificationRead } from "../lib/api";

export default function NotificationCentrePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-centre", page],
    queryFn: () => listNotificationsPage(page * limit, limit),
  });
  const notifications = data ?? [];

  return (
    <div>
      <PageTitle title="Notifications" sub="Your BuildProof activity and feature announcements." />
      {error && <ErrorBanner message="Notifications could not be loaded. Please try again." />}
      {isLoading && <LoadingBlock label="Loading notifications…" />}
      {!isLoading && notifications.length === 0 && <Card><EmptyState title={page === 0 ? "You are all caught up" : "No more notifications"} /></Card>}
      {notifications.length > 0 && (
        <Card>
          <CardHeader
            title="Recent notifications"
            action={<Button size="sm" variant="secondary" onClick={async () => {
              await markAllNotificationsRead();
              await qc.invalidateQueries();
            }}>Mark all read</Button>}
          />
          <ul className="divide-y divide-line px-5">
            {notifications.map((notification) => {
              const content = (
                <>
                  <span className="block font-semibold">{notification.title}</span>
                  {notification.body && <span className="mt-1 block text-[13px] text-ink-soft">{notification.body}</span>}
                  <time className="mt-2 block text-[11px] text-ink-soft">
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </>
              );
              return (
                <li key={notification.id} className="py-4">
                  {notification.link ? (
                    <Link
                      to={notification.link}
                      onClick={() => void markNotificationRead(notification.id)}
                      className={`block rounded-md ${notification.read ? "opacity-70" : "font-medium"}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(notification.id)}
                      className={`block w-full text-left ${notification.read ? "opacity-70" : "font-medium"}`}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {notifications.length > 0 && (
        <div className="mt-4 flex justify-between">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <Button variant="secondary" disabled={notifications.length < limit} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
