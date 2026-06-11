import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, ArrowLeft, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/api/errors';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(values.email);
      setSubmitted(true);
      toast.success('Check your email for reset instructions');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not send reset email'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">CareMind AI</span>
        </div>

        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary-50 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Forgot password?</h1>
          <p className="text-muted mt-2">
            {submitted
              ? 'If an account exists for that email, you will receive reset instructions shortly.'
              : 'Enter your email and we will send you a reset link.'}
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Send reset link
            </Button>
          </form>
        ) : (
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center h-11 px-6 text-lg font-medium rounded-lg border border-border bg-white text-slate-900 hover:bg-surface transition-all"
          >
            Back to sign in
          </Link>
        )}

        {!submitted && (
          <Link
            to="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-muted hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
