import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, Key, Monitor, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, CardHeader, Input, Badge, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { getUserDisplayName } from '@/utils/display-name';
import { hydrateAuthProfileAfterLogin } from '@/hooks/useAuthProfile';
import { formatDateTime } from '@/utils/formatDate';
import type { TrustedDevice } from '@/types';
import { DEMO_EMAIL_DOMAIN, isDemoAccountEmail } from '@/constants/demo-accounts';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [setupStep, setSetupStep] = useState<'qr' | 'verify'>('qr');

  const displayName = getUserDisplayName(user);
  const mfaEligible =
    user?.mfaEligible !== false && !isDemoAccountEmail(user?.email ?? '');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const setupMfaMutation = useMutation({
    mutationFn: authApi.setupMfa,
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to start MFA setup')),
  });

  const enableMfaMutation = useMutation({
    mutationFn: (code: string) => authApi.enableMfa(code),
    onSuccess: async () => {
      toast.success('MFA enabled successfully!');
      setMfaSetupOpen(false);
      setMfaCode('');
      setSetupStep('qr');
      await hydrateAuthProfileAfterLogin();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Invalid code, please try again')),
  });

  const trustedDevicesQuery = useQuery({
    queryKey: ['auth', 'trusted-devices'],
    queryFn: authApi.listTrustedDevices,
    enabled: Boolean(user?.mfaEnabled) && mfaEligible,
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeTrustedDevice(id),
    onSuccess: () => {
      toast.success('Device removed');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'trusted-devices'] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to remove device')),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Password updated successfully');
      reset();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to update password')),
  });

  const handleSetupMfa = () => {
    setMfaSetupOpen(true);
    setSetupStep('qr');
    setMfaCode('');
    setupMfaMutation.mutate();
  };

  const handleEnableMfa = () => {
    if (mfaCode.length === 6) {
      enableMfaMutation.mutate(mfaCode);
    }
  };

  const onPasswordSubmit = (values: PasswordFormValues) => {
    changePasswordMutation.mutate(values);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Profile" subtitle="Manage your account and security settings" />

      <Card className="mb-6">
        <CardHeader title="Account Information" />
        <div className="flex items-center gap-4">
          <Avatar name={displayName || user?.email} size="xl" />
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {displayName || user?.email}
            </h3>
            <p className="text-muted">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="primary" className="capitalize">{user?.role}</Badge>
              {user?.mfaEnabled && (
                <Badge variant="success">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  MFA Active
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Two-Factor Authentication"
          subtitle={
            !mfaEligible
              ? 'Not available for demo clinic accounts.'
              : user?.mfaEnabled
                ? 'Your account is protected with MFA.'
                : 'Add an extra layer of security to your account.'
          }
          action={
            !mfaEligible ? (
              <Badge variant="gray">Unavailable</Badge>
            ) : user?.mfaEnabled ? (
              <Badge variant="success">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="gray">
                <Shield className="w-3.5 h-3.5 mr-1" />
                Disabled
              </Badge>
            )
          }
        />

        {!mfaEligible && (
          <p className="text-sm text-muted">
            {`Accounts ending in @${DEMO_EMAIL_DOMAIN} are for demonstration only and cannot enable two-factor authentication.`}
          </p>
        )}

        {mfaEligible && !user?.mfaEnabled && (
          <>
            {!mfaSetupOpen ? (
              <Button
                variant="outline"
                leftIcon={<Shield className="w-4 h-4" />}
                onClick={handleSetupMfa}
                loading={setupMfaMutation.isPending}
              >
                Enable Two-Factor Auth
              </Button>
            ) : (
              <div className="space-y-4">
                {setupStep === 'qr' && (
                  setupMfaMutation.isPending ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                      <Skeleton className="w-[200px] h-[200px] rounded-lg" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  ) : setupMfaMutation.data ? (
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-sm text-muted text-center">
                        Step 1 of 2 — Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      <div className="p-4 bg-white border border-border rounded-lg shadow-card">
                        <QRCodeSVG
                          value={setupMfaMutation.data.otpAuthUrl}
                          size={200}
                          level="M"
                        />
                      </div>
                      <p className="text-xs text-muted text-center max-w-xs">
                        Can&apos;t scan? Enter this key manually in your app:{' '}
                        <code className="font-mono bg-surface px-1 py-0.5 rounded break-all">
                          {setupMfaMutation.data.secret}
                        </code>
                      </p>
                      <Button onClick={() => setSetupStep('verify')}>
                        I&apos;ve added it to my app — continue
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setMfaSetupOpen(false); setMfaCode(''); setSetupStep('qr'); }}
                        className="text-sm text-muted hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-danger text-center">
                      Could not load setup QR. Please try again.
                    </p>
                  )
                )}

                {setupStep === 'verify' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted">
                      Step 2 of 2 — Enter the 6-digit code from your authenticator to verify and enable MFA:
                    </p>
                    <div className="flex gap-3 items-end">
                      <Input
                        label="Verification Code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        containerClassName="flex-1"
                      />
                      <Button
                        onClick={handleEnableMfa}
                        loading={enableMfaMutation.isPending}
                        disabled={mfaCode.length !== 6}
                      >
                        Verify
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        onClick={() => setSetupStep('qr')}
                        className="text-sm text-primary hover:underline"
                      >
                        Back to QR code
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMfaSetupOpen(false); setMfaCode(''); setSetupStep('qr'); }}
                        className="text-sm text-muted hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {mfaEligible && user?.mfaEnabled && (
          <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 rounded-md p-3">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Two-factor authentication is active and protecting your account.
          </div>
        )}
      </Card>

      {mfaEligible && user?.mfaEnabled && (
        <Card className="mb-6">
          <CardHeader
            title="Trusted Devices"
            subtitle="Devices that can skip MFA for 30 days after you choose Yes on the trust-device prompt"
          />
          {trustedDevicesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : trustedDevicesQuery.data?.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {trustedDevicesQuery.data.map((device: TrustedDevice) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Monitor className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{device.deviceName}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {device.isActive
                          ? `Trusted until ${formatDateTime(device.trustedUntil)}`
                          : 'Expired'}
                        {device.lastUsedAt && ` · Last used ${formatDateTime(device.lastUsedAt)}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => revokeDeviceMutation.mutate(device.id)}
                    loading={revokeDeviceMutation.isPending}
                    aria-label={`Remove ${device.deviceName}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No trusted devices yet. After MFA at sign-in, choose Yes on the trust-device prompt to add this browser.
            </p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title="Change Password"
          subtitle="Update your account password"
          action={<Key className="w-5 h-5 text-muted" />}
        />
        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-3">
          <Input
            label="Current Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button
            type="submit"
            variant="outline"
            loading={changePasswordMutation.isPending}
          >
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
