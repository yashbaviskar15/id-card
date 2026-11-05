import { ForgotForm } from './forgot-form';

export const dynamic = 'force-dynamic';

export default function ForgotPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We will email a single-use link that expires in 30 minutes.
        </p>
        <ForgotForm />
      </div>
    </main>
  );
}
