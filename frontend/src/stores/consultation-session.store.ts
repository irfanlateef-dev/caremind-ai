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
}

interface ConsultationSessionActions {
  startSession: (payload: ConsultationSessionPayload) => void;
  endSession: () => void;
  setMinimized: (minimized: boolean) => void;
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;
}

const idleState: ConsultationSessionState = {
  status: 'idle',
  appointmentId: null,
  token: null,
  livekitUrl: null,
  appointment: null,
  isMinimized: false,
  sidePanelOpen: false,
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
    }),

  endSession: () => set(idleState),

  setMinimized: (minimized) => set({ isMinimized: minimized }),

  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),

  toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
}));
