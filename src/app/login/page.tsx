import LoginForm from "./login-form";

export const metadata = { title: "Owner sign in" };

export default function LoginPage() {
  return (
    <main className="lock-page">
      <section className="lock-panel" aria-labelledby="login-title">
        <div className="lock-mark">Owner access</div>
        <h1 id="login-title">Sign in privately</h1>
        <p>Use the owner email configured for this private card.</p>
        <LoginForm />
      </section>
    </main>
  );
}