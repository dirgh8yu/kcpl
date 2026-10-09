import { SignInLayout } from "./sign-in-layout";
import { AdminTwoStep } from "./admin-two-step";

/** The second step for Management and Accounts, after the password: set the authenticator up once, then a code each sign-in. */
export function AdminTwoStepPage({ step, email }: { step: "enrol" | "verify"; email: string }) {
  return (
    <SignInLayout
      title={step === "enrol" ? "Set up two-step sign-in" : "Enter your sign-in code"}
      lead={step === "enrol"
        ? "Management and Accounts sign in with a code from an authenticator app as well as the password, because these accounts issue credit notes and approve refunds."
        : `The 6-digit code from the authenticator app for ${email}.`}
      help={<>Lost the phone with the app? Use a recovery code, or ask another manager to reset two-step sign-in for you. <a href="/api/admin/session">Sign out</a></>}
    >
      <AdminTwoStep step={step}/>
    </SignInLayout>
  );
}
