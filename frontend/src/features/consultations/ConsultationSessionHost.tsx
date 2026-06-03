import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuthStore } from '@/stores/auth.store';
import { useConsultationSessionStore } from '@/stores/consultation-session.store';
import { UserRole } from '@/types';
import { ConsultationVideoRoom } from './ConsultationVideoRoom';
import { ConsultationMinimizedCall } from './ConsultationMinimizedCall';
import { consultationsApi } from '@/api/consultations.api';
import { ConsultationSidePanel } from './ConsultationSidePanel';

export function ConsultationSessionHost() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const status = useConsultationSessionStore((s) => s.status);
  const appointmentId = useConsultationSessionStore((s) => s.appointmentId);
  const token = useConsultationSessionStore((s) => s.token);
  const livekitUrl = useConsultationSessionStore((s) => s.livekitUrl);
  const appointment = useConsultationSessionStore((s) => s.appointment);
  const isMinimized = useConsultationSessionStore((s) => s.isMinimized);
  const sidePanelOpen = useConsultationSessionStore((s) => s.sidePanelOpen);
  const endSession = useConsultationSessionStore((s) => s.endSession);
  const toggleSidePanel = useConsultationSessionStore((s) => s.toggleSidePanel);
  const setSidePanelOpen = useConsultationSessionStore((s) => s.setSidePanelOpen);

  if (status !== 'active' || !token || !livekitUrl || !appointment || !appointmentId) {
    return null;
  }

  const isDoctor = role === UserRole.DOCTOR || role === UserRole.ADMIN;

  const handleDisconnected = () => {
    const { isRecording: recordingActive, appointmentId: apptId } =
      useConsultationSessionStore.getState();
    if (recordingActive && apptId) {
      void consultationsApi.stopRecording(apptId).catch(() => undefined);
    }
    endSession();
    navigate(`/appointments/${appointmentId}`);
  };

  const content = (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect
      video
      audio
      onDisconnected={handleDisconnected}
      className={isMinimized ? undefined : 'h-full w-full flex flex-col'}
    >
      {isMinimized ? (
        <ConsultationMinimizedCall />
      ) : (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900">
          <ConsultationVideoRoom
            appointment={appointment}
            isDoctor={isDoctor}
            sidePanelOpen={sidePanelOpen}
            onToggleSidePanel={toggleSidePanel}
            onMinimize={() => {
              useConsultationSessionStore.getState().setMinimized(true);
              navigate(`/appointments/${appointmentId}`);
            }}
          />
          {sidePanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm shadow-2xl">
              <ConsultationSidePanel
                appointmentId={appointmentId}
                onClose={() => setSidePanelOpen(false)}
              />
            </div>
          )}
          <RoomAudioRenderer />
        </div>
      )}
    </LiveKitRoom>
  );

  return createPortal(content, document.body);
}
