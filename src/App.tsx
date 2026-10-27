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
          </Route>
          <Route path="proof-cards/:proofCardId" element={<ProofCardDetailPage />} />
          <Route path="invites/:token" element={<InviteAcceptPage />} />

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
