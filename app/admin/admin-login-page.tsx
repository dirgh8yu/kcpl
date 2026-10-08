import { AdminLogin } from "./admin-login";
import { SignInLayout } from "./sign-in-layout";

export function AdminLoginPage() {
  return (
    <SignInLayout title="Sign in to KCPL Operations" help="No account yet? Ask a manager to add you.">
      <AdminLogin/>
    </SignInLayout>
  );
}
