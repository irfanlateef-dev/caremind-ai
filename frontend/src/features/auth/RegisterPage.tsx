import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Activity, Check, ChevronRight, Heart, Shield, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
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
    <div className="min-h-screen flex">
      {/* Left Panel — hidden on mobile */}
      <div className="hidden lg:flex flex-col w-1/2 bg-gradient-to-br from-primary-600 via-primary to-secondary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white" />
        </div>
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CareMind AI</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              Smarter care,<br />powered by AI.
            </h2>
            <p className="text-white/80 text-lg leading-relaxed max-w-sm">
              The intelligent healthcare platform that helps doctors focus on patients, not paperwork.
            </p>

            <div className="mt-12 grid grid-cols-1 gap-4">
              {[
                { icon: <Stethoscope className="w-5 h-5" />, title: 'AI Clinical Notes', desc: 'Auto-generated SOAP notes from consultations' },
                { icon: <Shield className="w-5 h-5" />, title: 'HIPAA Compliant', desc: 'End-to-end encrypted, audit-logged PHI' },
                { icon: <Heart className="w-5 h-5" />, title: 'Patient-First', desc: 'Streamlined experience for better outcomes' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-white/70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">CareMind AI</span>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Create your organization</h1>
            <p className="text-muted mt-1">Set up CareMind for your practice</p>
          </div>

          <div className="flex items-center gap-2 mb-8">
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

          {step === 1 && (
            <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Organization Details</h2>
              <Input
                label="Organization Name"
                placeholder="Sunrise Medical Center"
                error={form1.formState.errors.orgName?.message}
                {...form1.register('orgName', { onChange: handleOrgNameChange })}
              />
              <Input
                label="Organization Slug"
                placeholder="sunrise-medical"
                error={form1.formState.errors.orgSlug?.message}
                helperText={slugValue ? `Your URL: caremind.ai/org/${slugValue}` : undefined}
                {...form1.register('orgSlug')}
              />
              <Button type="submit" className="w-full" size="lg">
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Admin Account</h2>
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
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
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
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="text-muted hover:text-slate-700"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...form2.register('confirmPassword')}
              />
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" size="lg">
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          )}

          {step === 3 && step1Data && step2Data && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Review & Confirm</h2>
              <div className="bg-slate-50 border border-border rounded-lg p-4 space-y-3">
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
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" className="flex-1" size="lg" loading={isLoading} onClick={onFinalSubmit}>
                  Create Organization
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
