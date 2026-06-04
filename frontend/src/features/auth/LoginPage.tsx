import { useState, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Activity, Heart, Shield, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { hydrateAuthProfileAfterLogin } from '@/hooks/useAuthProfile';
import { cn } from '@/utils/cn';
import { getOrCreateDeviceId } from '@/lib/device';
import { TrustDevicePromptModal } from './TrustDevicePromptModal';
import { DEMO_LOGIN_ACCOUNTS, DEMO_SEED_PASSWORD, isDemoAccountEmail } from '@/constants/demo-accounts';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const mfaSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});
type MfaFormValues = z.infer<typeof mfaSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [trustPromptOpen, setTrustPromptOpen] = useState(false);
  const [trustRegistering, setTrustRegistering] = useState(false);
  const [postAuthPath, setPostAuthPath] = useState('/dashboard');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const resolvePostAuthPath = useCallback(() => {
    return from !== '/' && from !== '/login' ? from : '/dashboard';
  }, [from]);

  const finishLogin = useCallback(
    (path: string) => {
      navigate(path, { replace: true });
    },
    [navigate],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const emailValue = watch('email', '');
  const showDemoMfaNote = isDemoAccountEmail(emailValue);

  const { register: mfaRegister, handleSubmit: handleMfaSubmit, watch: watchMfa, formState: { errors: mfaErrors } } = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
  });

  const mfaCode = watchMfa('code', '');

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    const remember = Boolean(values.rememberMe);
    setRememberMe(remember);
    try {
      const res = await authApi.login({
        email: values.email,
        password: values.password,
        rememberMe: remember,
        deviceId: getOrCreateDeviceId(),
      });
      if (res.requiresMfa && res.mfaToken) {
        setLoginEmail(values.email);
        setMfaToken(res.mfaToken);
        setMfaStep(true);
        return;
      }
      if (res.user && res.accessToken && res.refreshToken) {
        login(res.user, res.accessToken, res.refreshToken);
        await hydrateAuthProfileAfterLogin();
        finishLogin(resolvePostAuthPath());
        return;
      }
      toast.error('Unexpected response from server. Please try again.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setIsLoading(false);
    }
  };

  const onMfaSubmit = async (values: MfaFormValues) => {
    setIsLoading(true);
    try {
      const res = await authApi.verifyMfa({
        mfaToken,
        code: values.code,
        rememberMe,
      });
      const user = { ...res.user, email: res.user.email || loginEmail };
      login(user, res.accessToken, res.refreshToken);
      await hydrateAuthProfileAfterLogin();
      setPostAuthPath(resolvePostAuthPath());
      setTrustPromptOpen(true);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid MFA code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrustYes = async () => {
    setTrustRegistering(true);
    try {
      await authApi.registerTrustedDevice(getOrCreateDeviceId());
      toast.success('This device is trusted for 30 days');
      setTrustPromptOpen(false);
      finishLogin(postAuthPath);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not trust this device'));
    } finally {
      setTrustRegistering(false);
    }
  };

  const handleTrustNo = () => {
    setTrustPromptOpen(false);
    finishLogin(postAuthPath);
  };

  const handleMfaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length === 6) {
      handleMfaSubmit(onMfaSubmit)();
    }
  };

  return (
    <div className="min-h-screen flex">
      <TrustDevicePromptModal
        open={trustPromptOpen}
        loading={trustRegistering}
        onYes={handleTrustYes}
        onNo={handleTrustNo}
      />

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
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">CareMind AI</span>
          </div>

          {!mfaStep ? (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
                <p className="text-muted mt-1">Sign in to your account</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={errors.password?.message}
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
                  {...register('password')}
                />

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                    {...register('rememberMe')}
                  />
                  <span className="text-sm text-slate-700">
                    Remember me
                    <span className="block text-xs text-muted mt-0.5">
                      Stay signed in for 5 days on this browser
                    </span>
                  </span>
                </label>

                {showDemoMfaNote && (
                  <p className="text-sm text-muted bg-slate-50 border border-border rounded-lg px-3 py-2">
                    Demo clinic accounts do not use two-factor authentication and cannot enable MFA in
                    settings.
                  </p>
                )}

                <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                  Sign in
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs font-medium text-slate-700 mb-1">Demo clinic (quick fill)</p>
                <p className="text-xs text-muted mb-3">
                  Password: <span className="font-mono text-slate-700">{DEMO_SEED_PASSWORD}</span> — MFA not
                  available for these accounts.
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_LOGIN_ACCOUNTS.map((account) => (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setValue('email', account.email, { shouldValidate: true });
                        setValue('password', DEMO_SEED_PASSWORD, { shouldValidate: true });
                      }}
                    >
                      {account.label}
                    </Button>
                  ))}
                </div>
              </div>

              <p className="text-center text-sm text-muted mt-6">
                New organization?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Register here
                </Link>
              </p>
            </>
          ) : (
            <div>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 text-center">Two-Factor Auth</h1>
                <p className="text-muted mt-2 text-center">Enter the 6-digit code from your authenticator app</p>
              </div>

              <form onSubmit={handleMfaSubmit(onMfaSubmit)} className="space-y-4">
                <div className="flex justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    {...mfaRegister('code', { onChange: handleMfaChange })}
                    className={cn(
                      'w-48 h-14 text-center text-3xl font-bold tracking-widest rounded-lg border-2 border-border',
                      'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all',
                      mfaErrors.code && 'border-danger',
                      mfaCode.length === 6 && 'border-success-500'
                    )}
                  />
                </div>
                {mfaErrors.code && (
                  <p className="text-sm text-danger text-center">{mfaErrors.code.message}</p>
                )}

                <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                  Verify
                </Button>

                <button
                  type="button"
                  onClick={() => setMfaStep(false)}
                  className="w-full text-sm text-muted hover:text-slate-700 transition-colors"
                >
                  Back to login
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
