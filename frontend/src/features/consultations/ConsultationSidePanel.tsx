import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Brain } from 'lucide-react';
import { consultationsApi, consultationKeys } from '@/api/consultations.api';
import { cn } from '@/utils/cn';

export function ConsultationSidePanel({
  appointmentId,
  onClose,
}: {
  appointmentId: string;
  onClose: () => void;
}) {
  const { data: transcript } = useQuery({
    queryKey: consultationKeys.transcript(appointmentId),
    queryFn: () => consultationsApi.getTranscript(appointmentId),
    refetchInterval: 10000,
    retry: 1,
  });

  const [activeTab, setActiveTab] = useState<'transcript' | 'ai'>('transcript');

  return (
    <div className="w-full h-full bg-slate-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex gap-2">
          {(['transcript', 'ai'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {tab === 'ai' ? 'AI Outputs' : 'Transcript'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
          aria-label="Close side panel"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'transcript' && (
          transcript ? (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {transcript.content}
            </pre>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                Transcript will appear here once recording is processed.
              </p>
            </div>
          )
        )}
        {activeTab === 'ai' && (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              AI outputs will be available after the consultation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
