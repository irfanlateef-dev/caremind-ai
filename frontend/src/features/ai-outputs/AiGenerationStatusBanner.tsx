import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { aiOutputsApi, aiOutputKeys, type AiGenerationStatus } from '@/api/aiOutputs.api';
import { UserRole } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

const STATUS_COPY: Record<
  AiGenerationStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }
> = {
  no_transcript: { label: 'No transcript', tone: 'neutral' },
  pending_consent: { label: 'Awaiting consent', tone: 'neutral' },
  processing: { label: 'Generating AI outputs…', tone: 'info' },
  ready: { label: 'Generation complete', tone: 'success' },
  failed: { label: 'Generation failed', tone: 'danger' },
};

interface AiGenerationStatusBannerProps {
  appointmentId: string;
  onOutputsReady?: () => void;
}

export function AiGenerationStatusBanner({
  appointmentId,
  onOutputsReady,
}: AiGenerationStatusBannerProps) {
  const role = useAuthStore((s) => s.role);
  const isStaff = role === UserRole.DOCTOR || role === UserRole.ADMIN;
  const queryClient = useQueryClient();
  const prevStatus = useRef<AiGenerationStatus | undefined>();

  const { data: status, isLoading } = useQuery({
    queryKey: aiOutputKeys.generationStatus(appointmentId),
    queryFn: () => aiOutputsApi.getGenerationStatus(appointmentId),
    enabled: isStaff && !!appointmentId,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 4000 : false),
  });

  useEffect(() => {
    if (status?.status === 'ready' && prevStatus.current === 'processing') {
      onOutputsReady?.();
    }
    prevStatus.current = status?.status;
  }, [status?.status, onOutputsReady]);

  const retryMutation = useMutation({
    mutationFn: () => aiOutputsApi.retryGeneration(appointmentId),
    onSuccess: () => {
      toast.success('AI generation restarted');
      void queryClient.invalidateQueries({ queryKey: aiOutputKeys.generationStatus(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: aiOutputKeys.byAppointment(appointmentId) });
    },
    onError: () => toast.error('Could not retry AI generation'),
  });

  if (!isStaff || isLoading || !status) return null;

  if (status.status === 'ready') return null;

  const copy = STATUS_COPY[status.status];

  return (
    <div
      className={`rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        copy.tone === 'danger'
          ? 'border-danger/30 bg-danger-50'
          : copy.tone === 'info'
            ? 'border-primary/20 bg-primary-50'
            : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        {status.status === 'processing' ? (
          <Loader2 className="w-5 h-5 text-primary shrink-0 animate-spin mt-0.5" />
        ) : status.status === 'failed' ? (
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-muted shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-sm font-medium text-slate-800">{copy.label}</p>
          <p className="text-sm text-muted mt-0.5">{status.message}</p>
          {status.recordingStatus && (
            <p className="text-xs text-muted mt-1">Recording: {status.recordingStatus}</p>
          )}
        </div>
      </div>
      {status.canRetry && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          loading={retryMutation.isPending}
          onClick={() => retryMutation.mutate()}
        >
          Retry generation
        </Button>
      )}
    </div>
  );
}
