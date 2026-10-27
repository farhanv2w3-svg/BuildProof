import { ButtonLink, EmptyState } from "../components/ui";

export default function NotFoundPage() {
  return (
    <div className="container-xl flex min-h-[70vh] items-center justify-center px-4">
      <EmptyState
        title="Page not found"
        description="The page you're after doesn't exist. Everything public is reachable from the header."
        action={<ButtonLink to="/">Go home</ButtonLink>}
      />
    </div>
  );
}
