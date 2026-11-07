import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotForm } from './forgot-form';

export const dynamic = 'force-dynamic';

export default function ForgotPage() {
  return (
    <AuthScreen
      title="Reset your password"
      description="Enter your account email and we will send a secure, single-use reset link."
    >
      <ForgotForm />
    </AuthScreen>
  );
}
