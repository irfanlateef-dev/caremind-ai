import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Spinner } from '@/components/ui';
import { appointmentsApi, appointmentKeys } from '@/api/appointments.api';
import { consultationsApi } from '@/api/consultations.api';
import { useAuthStore } from '@/stores/auth.store';
import { useConsultationSessionStore } from '@/stores/consultation-session.store';
import { UserRole } from '@/types';

function ConsentGate({
  appointmentId,
  onAccepted,
}: {
  appointmentId: string;
  onAccepted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await appointmentsApi.updateConsent(appointmentId, 'accepted');
      onAccepted();
    } catch {
      toast.error('Failed to update consent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center" padding="lg">
        <div className="w-16 h-16 rounded-full bg-warning-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-warning" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Recording Consent</h2>
        <p className="text-muted text-base mb-6 leading-relaxed">
          This consultation session will be recorded for AI-assisted clinical note generation.
          Your recording will be processed securely and used only for this appointment.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>
            Decline & Leave
          </Button>
          <Button className="flex-1" loading={loading} onClick={handleAccept}>
            Accept & Join
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function ConsultationRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuthStore();
  const startSession = useConsultationSessionStore((s) => s.startSession);
  const setMinimized = useConsultationSessionStore((s) => s.setMinimized);
  const sessionStatus = useConsultationSessionStore((s) => s.status);
  const sessionAppointmentId = useConsultationSessionStore((s) => s.appointmentId);
  const [consentGranted, setConsentGranted] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const { data: appointment } = useQuery({
    queryKey: appointmentKeys.detail(id!),
    queryFn: () => appointmentsApi.get(id!),
    enabled: !!id,
  });

  const needsConsent =
    role === UserRole.PATIENT && appointment?.consentStatus !== 'accepted' && !consentGranted;

  const fetchToken = useCallback(async () => {
    if (!id || !appointment) return;
    setTokenLoading(true);
    setTokenError('');
    try {
      const res = await consultationsApi.getJoinToken(id);
      if (res.requiresConsent) {
        setTokenError('Recording consent is required before joining.');
        return;
      }
      startSession({
        appointmentId: id,
        token: res.token,
        livekitUrl: res.livekitUrl,
        appointment,
        isMinimized: false,
      });
    } catch {
      setTokenError('Failed to join consultation. Please try again.');
    } finally {
      setTokenLoading(false);
    }
  }, [id, appointment, startSession]);

  useEffect(() => {
    if (sessionStatus === 'active' && sessionAppointmentId === id) {
      setMinimized(false);
    }
  }, [id, sessionStatus, sessionAppointmentId, setMinimized]);

  useEffect(() => {
    if (!needsConsent && appointment && sessionStatus !== 'active') {
      void fetchToken();
    }
  }, [needsConsent, appointment, sessionStatus, fetchToken]);

  if (needsConsent) {
    return (
      <ConsentGate
        appointmentId={id!}
        onAccepted={() => setConsentGranted(true)}
      />
    );
  }

  if (tokenLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-white mx-auto mb-4" />
          <p className="text-white/80">Connecting to consultation room…</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <Card className="max-w-sm w-full text-center" padding="lg">
          <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Failed</h2>
          <p className="text-muted text-sm mb-4">{tokenError}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => void fetchToken()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (sessionStatus === 'active' && sessionAppointmentId === id) {
    return (
      <div className="min-h-screen bg-slate-950" aria-hidden>
        {/* Full call UI is rendered by ConsultationSessionHost */}
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Spinner size="lg" className="text-white" />
      </div>
    );
  }

  return null;
}
