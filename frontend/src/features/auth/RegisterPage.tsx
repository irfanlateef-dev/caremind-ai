import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Activity, Check, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { hydrateAuthProfileAfterLogin } from '@/hooks/useAuthProfile';
import { generateSlug } from '@/utils';
import { cn } from '@/utils/cn';

const step1Schema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  orgSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
});

const step2Schema = z.object({
  adminEmail: z.string().email('Enter a valid email'),
  adminPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include one uppercase letter')
    .regex(/[0-9]/, 'Include one number'),
  confirmPassword: z.string(),
}).refine((d) => d.adminPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-danger', 'bg-warning', 'bg-warning-300', 'bg-success'];
  return { score, label: labels[score - 1] ?? 'Weak', color: colors[score - 1] ?? 'bg-danger' };
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Values | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Values>({ resolver: zodResolver(step2Schema) });

  const orgNameValue = form1.watch('orgName', '');
  const passwordValue = form2.watch('adminPassword', '');
  const slugValue = form1.watch('orgSlug', '');
  const strength = passwordStrength(passwordValue);

  // Auto-generate slug from org name
  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form1.setValue('orgName', e.target.value);
    if (!form1.getValues('orgSlug') || form1.getValues('orgSlug') === generateSlug(orgNameValue)) {
      form1.setValue('orgSlug', generateSlug(e.target.value));
    }
  };

  const onStep1Submit = (data: Step1Values) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: Step2Values) => {
    setStep2Data(data);
    setStep(3);
  };

  const onFinalSubmit = async () => {
    if (!step1Data || !step2Data) return;
    setIsLoading(true);
    try {
      const res = await authApi.register({
        orgName: step1Data.orgName,
        orgSlug: step1Data.orgSlug,
        adminEmail: step2Data.adminEmail,
        adminPassword: step2Data.adminPassword,
      });
      login(res.user, res.accessToken, res.refreshToken);
      await hydrateAuthProfileAfterLogin();
      toast.success('Organization created! Welcome to CareMind.');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Organization' },
    { num: 2, label: 'Admin Account' },
    { num: 3, label: 'Review' },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">CareMind AI</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Create your organization</h1>
          <p className="text-muted mt-1">Set up CareMind for your practice</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                  step > s.num
                    ? 'bg-success text-white'
                    : step === s.num
                    ? 'bg-primary text-white'
                    : 'bg-border text-muted'
                )}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:block',
                  step === s.num ? 'text-slate-900' : 'text-muted'
                )}
              >
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted mx-1" />
              )}
            </div>
          ))}
        </div>

        <Card elevated>
          {step === 1 && (
            <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Organization Details</h2>
              <Input
                label="Organization Name"
                placeholder="Sunrise Medical Center"
                error={form1.formState.errors.orgName?.message}
                {...form1.register('orgName', { onChange: handleOrgNameChange })}
              />
              <div>
                <Input
                  label="Organization Slug"
                  placeholder="sunrise-medical"
                  error={form1.formState.errors.orgSlug?.message}
                  helperText={slugValue ? `Your URL: caremind.ai/org/${slugValue}` : undefined}
                  {...form1.register('orgSlug')}
                />
              </div>
              <Button type="submit" className="w-full" size="lg">
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Admin Account</h2>
              <Input
                label="Admin Email"
                type="email"
                autoComplete="email"
                placeholder="admin@yourpractice.com"
                error={form2.formState.errors.adminEmail?.message}
                {...form2.register('adminEmail')}
              />
              <div>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={form2.formState.errors.adminPassword?.message}
                  trailingIcon={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  {...form2.register('adminPassword')}
                />
                {passwordValue && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-all',
                            i <= strength.score ? strength.color : 'bg-border'
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted">{strength.label}</span>
                  </div>
                )}
              </div>
              <Input
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                error={form2.formState.errors.confirmPassword?.message}
                trailingIcon={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label="Toggle confirm password">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...form2.register('confirmPassword')}
              />
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" size="md">
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          )}

          {step === 3 && step1Data && step2Data && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Review & Confirm</h2>
              <div className="bg-surface rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide font-medium mb-1">Organization</p>
                  <p className="font-semibold text-slate-900">{step1Data.orgName}</p>
                  <p className="text-sm text-muted">caremind.ai/org/{step1Data.orgSlug}</p>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide font-medium mb-1">Admin Account</p>
                  <p className="font-semibold text-slate-900">{step2Data.adminEmail}</p>
                  <p className="text-sm text-muted">Role: Administrator</p>
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" className="flex-1" size="md" loading={isLoading} onClick={onFinalSubmit}>
                  Create Organization
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
