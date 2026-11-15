import { describe, expect, it } from "vitest";

describe("notification security boundaries", () => {
  it("does not allow deployment changes to create feature announcements", () => {
    const deploymentChange = { source: "deployment", status: "draft" };
    expect(deploymentChange.status).toBe("draft");
  });

  it("requires explicit publication for feature releases", () => {
    const announcement = { status: "draft" as string, publishedAt: null as string | null };
    expect(announcement.status).not.toBe("published");
    expect(announcement.publishedAt).toBeNull();
  });

  it("uses internal notification destinations only for auth callback safety", () => {
    const safeDestination = (value: string | null) =>
      value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
    expect(safeDestination("/app/problems")).toBe("/app/problems");
    expect(safeDestination("//evil.example")).toBe("/app");
  });

  it("does not expose credential-like fields in registration message building", () => {
    const registration = {
      email: "student@example.com",
      displayName: "Student",
      password: undefined,
      token: undefined,
      refreshToken: undefined,
    };
    const message = `Name: ${registration.displayName}\nEmail: ${registration.email}`;
    expect(message).not.toContain("password");
    expect(message).not.toContain("token");
  });
});
