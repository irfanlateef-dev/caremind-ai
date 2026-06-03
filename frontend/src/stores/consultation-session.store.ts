import { create } from 'zustand';
import type { Appointment } from '@/types';

export interface ConsultationSessionPayload {
  appointmentId: string;
  token: string;
  livekitUrl: string;
  appointment: Appointment;
  isMinimized?: boolean;
}

interface ConsultationSessionState {
  status: 'idle' | 'active';
  appointmentId: string | null;
  token: string | null;
  livekitUrl: string | null;
  appointment: Appointment | null;
  isMinimized: boolean;
  sidePanelOpen: boolean;
  recordingId: string | null;
  isRecording: boolean;
  liveTranscriptText: string;
}

interface ConsultationSessionActions {
  startSession: (payload: ConsultationSessionPayload) => void;
  endSession: () => void;
  setMinimized: (minimized: boolean) => void;
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;
  setRecording: (recordingId: string | null) => void;
  setLiveTranscriptText: (text: string) => void;
}

const idleState: ConsultationSessionState = {
  status: 'idle',
  appointmentId: null,
  token: null,
  livekitUrl: null,
  appointment: null,
  isMinimized: false,
  sidePanelOpen: false,
  recordingId: null,
  isRecording: false,
  liveTranscriptText: '',
};

export const useConsultationSessionStore = create<
  ConsultationSessionState & ConsultationSessionActions
>()((set) => ({
  ...idleState,

  startSession: (payload) =>
    set({
      status: 'active',
      appointmentId: payload.appointmentId,
      token: payload.token,
      livekitUrl: payload.livekitUrl,
      appointment: payload.appointment,
      isMinimized: payload.isMinimized ?? false,
      sidePanelOpen: false,
      recordingId: null,
      isRecording: false,
      liveTranscriptText: '',
    }),

  endSession: () => set(idleState),

  setMinimized: (minimized) => set({ isMinimized: minimized }),

  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),

  toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),

  setRecording: (recordingId) =>
    set({
      recordingId,
      isRecording: recordingId !== null,
      liveTranscriptText: recordingId ? '' : '',
    }),

  setLiveTranscriptText: (text) => set({ liveTranscriptText: text }),
}));
