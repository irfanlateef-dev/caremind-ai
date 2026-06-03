import {
  Circle,
  ChevronRight,
  FileText,
  Minimize2,
  PanelRightOpen,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ConnectionStateToast, StartMediaButton } from '@livekit/components-react';
import { Button } from '@/components/ui';
import { consultationsApi } from '@/api/consultations.api';
import type { Appointment } from '@/types';
import { cn } from '@/utils/cn';
import { buildParticipantLabels, getCallTitle } from './consultation-participants';
import { useConsultationSessionStore } from '@/stores/consultation-session.store';
import { ConsultationCallLayout } from './ConsultationCallLayout';
import { ConsultationCallControls } from './ConsultationCallControls';
import { ConsultationLiveRecorder } from './ConsultationLiveRecorder';

function CallHeader({
  callTitle,
  isDoctor,
  isRecording,
  sidePanelOpen,
  onToggleSidePanel,
  onToggleRecording,
  recordingLoading,
  onMinimize,
}: {
  callTitle: string;
  isDoctor: boolean;
  isRecording: boolean;
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  onToggleRecording: () => void;
  recordingLoading: boolean;
  onMinimize: () => void;
}) {
  return (
    <header className="shrink-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-300/90">
          CareMind
        </p>
        <p className="text-sm sm:text-base font-medium text-white truncate">{callTitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onMinimize}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Minimize call to picture-in-picture"
          title="Minimize — keep call active while you work elsewhere"
        >
          <Minimize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Minimize</span>
        </button>
        {isDoctor && (
          <Button
            variant={isRecording ? 'danger' : 'outline'}
            size="sm"
            leftIcon={<Circle className={cn('w-3 h-3', isRecording && 'fill-current')} />}
            loading={recordingLoading}
            onClick={onToggleRecording}
            className={cn(
              !isRecording &&
                'bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/25'
            )}
          >
            {isRecording ? 'Stop' : 'Record'}
          </Button>
        )}
        {isDoctor && isRecording && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-red-400 font-medium">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            REC
          </span>
        )}
        <button
          type="button"
          onClick={onToggleSidePanel}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            sidePanelOpen
              ? 'bg-primary text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
          )}
        >
          {sidePanelOpen ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {sidePanelOpen ? 'Hide' : 'Notes'}
          </span>
          <FileText className="w-4 h-4 sm:hidden" />
        </button>
      </div>
    </header>
  );
}

export function ConsultationVideoRoom({
  appointment,
  isDoctor,
  sidePanelOpen,
  onToggleSidePanel,
  onMinimize,
}: {
  appointment: Appointment;
  isDoctor: boolean;
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  onMinimize: () => void;
}) {
  const recordingId = useConsultationSessionStore((s) => s.recordingId);
  const isRecording = useConsultationSessionStore((s) => s.isRecording);
  const setRecording = useConsultationSessionStore((s) => s.setRecording);
  const labels = buildParticipantLabels(appointment);
  const callTitle = getCallTitle(appointment);

  const startRecordingMutation = useMutation({
    mutationFn: () => consultationsApi.startRecording(appointment.id),
    onSuccess: (data) => {
      setRecording(data.id);
      toast.success('Live transcription started');
    },
    onError: () => toast.error('Failed to start recording'),
  });

  const stopRecordingMutation = useMutation({
    mutationFn: () => consultationsApi.stopRecording(appointment.id),
    onSuccess: () => {
      setRecording(null);
      toast.success('Recording stopped — generating summary');
    },
    onError: () => toast.error('Failed to stop recording'),
  });

  const recordingLoading =
    startRecordingMutation.isPending || stopRecordingMutation.isPending;

  return (
    <div data-lk-theme="default" className="flex flex-col h-full w-full min-h-0 bg-slate-950">
      <CallHeader
        callTitle={callTitle}
        isDoctor={isDoctor}
        isRecording={isRecording}
        sidePanelOpen={sidePanelOpen}
        onToggleSidePanel={onToggleSidePanel}
        onToggleRecording={() =>
          isRecording
            ? stopRecordingMutation.mutate()
            : startRecordingMutation.mutate()
        }
        recordingLoading={recordingLoading}
        onMinimize={onMinimize}
      />
      {isDoctor && (
        <ConsultationLiveRecorder
          recordingId={recordingId}
          active={isRecording}
          onTranscript={({ fullText }) =>
            useConsultationSessionStore.getState().setLiveTranscriptText(fullText)
          }
        />
      )}
      <ConsultationCallLayout labels={labels} />
      <ConsultationCallControls />
      <ConnectionStateToast />
      <StartMediaButton className="sr-only" />
    </div>
  );
}
