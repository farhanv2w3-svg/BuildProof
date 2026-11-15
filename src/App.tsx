import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/layout";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth, RequireRoles } from "./features/auth/guards";
import { BackendNotice } from "./components/BackendNotice";

import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import PublicProofCardsPage from "./pages/PublicProofCardsPage";
import ForStudentsPage from "./pages/ForStudentsPage";
import ForCollegesPage from "./pages/ForCollegesPage";
import ForProblemOwnersPage from "./pages/ForProblemOwnersPage";
import ForMentorsPage from "./pages/ForMentorsPage";
import ApplyPage from "./pages/ApplyPage";
import SubmitProblemPage from "./pages/SubmitProblemPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import ProfilePage from "./features/auth/ProfilePage";

import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import AuthCallbackPage from "./features/auth/AuthCallbackPage";

import DashboardPage from "./features/dashboard/DashboardPage";
import ProblemsPage from "./features/problems/ProblemsPage";
import CohortPage from "./features/cohorts/CohortPage";
import InstitutionPage from "./features/institution/InstitutionPage";
import TeamLayout from "./features/teams/TeamLayout";
import TeamOverviewPage from "./features/teams/TeamOverviewPage";
import EvidencePage from "./features/evidence/EvidencePage";
import FeasibilityPage from "./features/feasibility/FeasibilityPage";
import TestsPage from "./features/testing/TestsPage";
import ProofCardDetailPage from "./features/proof-cards/ProofCardDetailPage";
import { InviteAcceptPage } from "./features/teams/TeamLayout";
import MentorPage from "./features/mentor/MentorPage";
import AdminPage from "./features/admin/AdminPage";

/* 0003 — platform domains */
import PublicProblemsPage from "./pages/PublicProblemsPage";
import DemoProblemWalkthroughPage from "./features/problems/DemoProblemWalkthroughPage";
import PublicSolutionsPage from "./pages/PublicSolutionsPage";
import PublicCompanyProjectsPage from "./pages/PublicCompanyProjectsPage";
import PublicStartupsPage from "./pages/PublicStartupsPage";
import PublicHardwarePage from "./pages/PublicHardwarePage";
import PublicOpportunitiesPage from "./pages/PublicOpportunitiesPage";
import MyProofPage from "./features/proof/MyProofPage";
import TeamPlanPage from "./features/teams/TeamPlanPage";
import TeamRolesPage from "./features/teams/TeamRolesPage";
import TeamSolutionsPage from "./features/proof/TeamSolutionsPage";
import TeamChatPage from "./features/teams/TeamChatPage";
import OrgWorkspacePage from "./features/orgs/OrgWorkspacePage";
import MyHardwarePage from "./features/hardware/MyHardwarePage";
import MyOpportunitiesPage from "./features/opportunities/MyOpportunitiesPage";
import NotificationCentrePage from "./pages/NotificationCentrePage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";

/* 0004 — college events */
import EventsPage from "./features/events/EventsPage";
import EventDetailPage from "./features/events/EventDetailPage";
import EventEditorPage from "./features/events/EventEditorPage";
import MyEventsPage from "./features/events/MyEventsPage";

/* 0015 — EventSpace */
import EventSpaceLanding from "./features/eventspace/EventSpaceLanding";
import EventPublicPage from "./features/eventspace/EventPublicPage";
import EventShowcasePage from "./features/eventspace/EventShowcasePage";
import RegistrationPage from "./features/eventspace/RegistrationPage";
import ParticipantDashboard from "./features/eventspace/ParticipantDashboard";
import SubmissionWorkspace from "./features/eventspace/SubmissionWorkspace";
import OrganizerPage from "./features/eventspace/OrganizerPage";
import CreateEventPage from "./features/eventspace/CreateEventPage";
import OrganizerWorkspace from "./features/eventspace/OrganizerWorkspace";
import JudgeWorkspace, { JudgeEvaluationPage } from "./features/eventspace/JudgeWorkspace";
import PromotionKitPage from "./features/eventspace/PromotionKitPage";

export default function App() {
  return (
    <>
      <noscript>BuildProof requires JavaScript to run.</noscript>
      <BackendNotice />
      <Routes>
        {/* Public marketing pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/proof-cards" element={<PublicProofCardsPage />} />
          <Route path="/for-students" element={<ForStudentsPage />} />
          <Route path="/for-colleges" element={<ForCollegesPage />} />
          <Route path="/for-problem-owners" element={<ForProblemOwnersPage />} />
          <Route path="/for-mentors" element={<ForMentorsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          {/* 0003 domains */}
          <Route path="/problems" element={<PublicProblemsPage />} />
          {/* End-to-end demo walkthrough (fictional, client-only) */}
          <Route path="/problems/demo-material-wastage" element={<DemoProblemWalkthroughPage />} />
          <Route path="/solutions" element={<PublicSolutionsPage />} />
          <Route path="/company-projects" element={<PublicCompanyProjectsPage />} />
          <Route path="/startups-funding" element={<PublicStartupsPage />} />
          <Route path="/hardware" element={<PublicHardwarePage />} />
          <Route path="/opportunities" element={<PublicOpportunitiesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />

          {/* 0015 EventSpace (public) */}
          <Route path="/eventspace" element={<EventSpaceLanding />} />
          <Route path="/eventspace/:slug" element={<EventPublicPage />} />
          <Route path="/eventspace/:slug/showcase" element={<EventShowcasePage />} />
          <Route path="/eventspace/:slug/register" element={<RegistrationPage />} />
          <Route path="/eventspace/organizer" element={<OrganizerPage />} />
        </Route>

        {/* Auth pages (standalone, focused layout) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Gated by auth, any role */}
        <Route
          path="/submit-problem"
          element={
            <RequireAuth>
              <SubmitProblemPage />
            </RequireAuth>
          }
        />

        {/* Authenticated app */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="cohorts/:cohortId" element={<CohortPage />} />
          <Route path="teams/:teamId" element={<TeamLayout />}>
            <Route index element={<TeamOverviewPage />} />
            <Route path="evidence" element={<EvidencePage />} />
            <Route path="feasibility" element={<FeasibilityPage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="plan" element={<TeamPlanPage />} />
            <Route path="roles" element={<TeamRolesPage />} />
            <Route path="solutions" element={<TeamSolutionsPage />} />
            <Route path="chat" element={<TeamChatPage />} />
          </Route>
          <Route path="proof-cards/:proofCardId" element={<ProofCardDetailPage />} />
          <Route path="invites/:token" element={<InviteAcceptPage />} />

          {/* 0003 domains (authenticated; permissions enforced by RLS) */}
          <Route path="my-proof" element={<MyProofPage />} />
          <Route path="organizations" element={<OrgWorkspacePage />} />
          <Route path="hardware" element={<MyHardwarePage />} />
          <Route path="opportunities" element={<MyOpportunitiesPage />} />

          {/* 0004 college events */}
          <Route path="events" element={<EventsPage />} />
          <Route path="events/create" element={<EventEditorPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="my-events" element={<MyEventsPage />} />
          <Route path="my-events/:eventId/edit" element={<EventEditorPage />} />

          {/* 0015 EventSpace (authenticated) */}
          <Route path="eventspace" element={<ParticipantDashboard />} />
          <Route path="eventspace/create" element={<CreateEventPage />} />
          <Route path="eventspace/:eventId/edit" element={<CreateEventPage />} />
          <Route path="eventspace/:eventId/submit" element={<SubmissionWorkspace />} />
          <Route path="eventspace/:eventId/manage" element={<OrganizerWorkspace />} />
          <Route path="eventspace/:eventId/promote" element={<PromotionKitPage />} />
          <Route path="eventspace/judging" element={<JudgeWorkspace />} />
          <Route path="eventspace/judging/:assignmentId" element={<JudgeEvaluationPage />} />

          <Route
            path="mentor"
            element={
              <RequireRoles allowed={["mentor", "facilitator", "faculty_coordinator", "institution_admin", "platform_admin"]}>
                <MentorPage />
              </RequireRoles>
            }
          />
          <Route
            path="institution"
            element={
              <RequireRoles allowed={["institution_admin", "faculty_coordinator", "platform_admin"]}>
                <InstitutionPage />
              </RequireRoles>
            }
          />
          <Route
            path="admin"
            element={
              <RequireRoles allowed={["platform_admin"]}>
                <AdminPage />
              </RequireRoles>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationCentrePage />} />
          <Route path="notification-preferences" element={<NotificationPreferencesPage />} />
          <Route path="access-denied" element={<AccessDeniedPage />} />
        </Route>

        {/* Defaults */}
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
