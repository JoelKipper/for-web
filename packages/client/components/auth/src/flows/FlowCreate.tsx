import { Navigate } from "@revolt/routing";

/**
 * Registration is no longer a separate flow - FlowLogin now decides
 * between logging in and creating an account based on the email entered.
 * This redirect exists so old /create and /create/:code links still land
 * somewhere sensible.
 */
export default function FlowCreate() {
  return <Navigate href="/login/auth" />;
}
