import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotForm } from './forgot-form';
import { createShareMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = createShareMetadata({
  title: 'Reset your password',
  description: 'Request a secure, single-use password reset link for your private identity vault.',
  path: '/forgot',
});

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
