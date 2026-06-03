import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { JwtPayload } from '../../types/auth.js';
import { getTenantDbUrl } from '../../core/tenant-registry.js';
import { getTenantPrisma } from '../../core/tenant-prisma.js';
import * as repo from './consultations.repository.js';
import { getLiveSession, sendRoleAudio } from './live-transcript.session.js';
import type { SpeakerRole } from './consultation-speaker-labels.js';
import { logger } from '../../config/logger.js';

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function parseStreamRole(value: string | null): SpeakerRole | null {
  if (value === 'doctor' || value === 'patient') return value;
  return null;
}

export function attachLiveTranscriptWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`);
    if (url.pathname !== '/api/consultations/live-audio') {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws: WebSocket, request) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const recordingId = url.searchParams.get('recordingId');
    const streamRole = parseStreamRole(url.searchParams.get('streamRole'));

    if (!token || !recordingId || !streamRole) {
      ws.close(4001, 'Missing token, recordingId, or streamRole (doctor|patient)');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4002, 'Invalid token');
      return;
    }

    const session = getLiveSession(recordingId);
    if (!session) {
      ws.close(4004, 'Live session not found');
      return;
    }

    try {
      const tenantDbUrl = await getTenantDbUrl(payload.orgId);
      const tenantPrisma = getTenantPrisma(tenantDbUrl);
      const appointment = await repo.findAppointmentById(tenantPrisma, session.appointmentId);
      if (!appointment || appointment.orgId !== payload.orgId) {
        ws.close(4003, 'Forbidden');
        return;
      }

      if (payload.role === 'doctor') {
        const doctor = await repo.findDoctorByUserId(tenantPrisma, payload.sub);
        if (!doctor || appointment.doctorId !== doctor.id) {
          ws.close(4003, 'Forbidden');
          return;
        }
      } else if (payload.role !== 'admin') {
        ws.close(4003, 'Only doctor may stream audio');
        return;
      }
    } catch (err) {
      logger.error({ err }, 'Live audio WS auth failed');
      ws.close(1011, 'Server error');
      return;
    }

    const onTranscript = (payload: { fullText: string; interimText: string; line: unknown }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'transcript', ...payload }));
      }
    };
    session.emitter.on('transcript', onTranscript);

    ws.on('message', (data, isBinary) => {
      if (!isBinary) return;
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      sendRoleAudio(recordingId, streamRole, chunk);
    });

    ws.on('close', () => {
      session.emitter.off('transcript', onTranscript);
    });

    ws.send(JSON.stringify({ type: 'ready', recordingId, streamRole }));
  });
}
