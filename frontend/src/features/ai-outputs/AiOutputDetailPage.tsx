import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Edit3, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, CardHeader, Textarea, Modal, Skeleton } from '@/components/ui';
import { MarkdownContent } from '@/components/shared/MarkdownContent';
import { AiOutputStatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { aiOutputsApi, aiOutputKeys } from '@/api/aiOutputs.api';
import { AiGenerationStatusBanner } from './AiGenerationStatusBanner';
import type { AiOutput, AiOutputType } from '@/types';
import { UserRole } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils';

const TYPE_LABELS: Record<AiOutputType, string> = {
  soap_note: 'SOAP Note',
  clinical_summary: 'Clinical Summary',
  patient_summary: 'Patient Summary',
  followup_instructions: 'Follow-up Instructions',
};

interface OutputCardProps {
  output: AiOutput;
  onRefresh: () => void;
}

function OutputCard({ output, onRefresh }: OutputCardProps) {
  const role = useAuthStore((s) => s.role);
  const canReview = role === UserRole.DOCTOR || role === UserRole.ADMIN;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(output.currentContent);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: history } = useQuery({
    queryKey: aiOutputKeys.history(output.id),
    queryFn: () => aiOutputsApi.getHistory(output.id),
    enabled: historyOpen,
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) => aiOutputsApi.save(output.id, content),
    onSuccess: () => {
      toast.success('Changes saved');
      setEditing(false);
      onRefresh();
      queryClient.invalidateQueries({ queryKey: aiOutputKeys.all });
    },
    onError: () => toast.error('Failed to save'),
  });

  const approveMutation = useMutation({
    mutationFn: (editedContent?: string) => aiOutputsApi.approve(output.id, editedContent),
    onSuccess: () => {
      toast.success('Output approved');
      setEditing(false);
      onRefresh();
      queryClient.invalidateQueries({ queryKey: aiOutputKeys.all });
      queryClient.invalidateQueries({ queryKey: aiOutputKeys.generationStatus(output.appointmentId) });
    },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => aiOutputsApi.reject(output.id),
    onSuccess: () => {
      toast.success('Output rejected');
      onRefresh();
      queryClient.invalidateQueries({ queryKey: aiOutputKeys.all });
    },
    onError: () => toast.error('Failed to reject'),
  });

  const isDirty = editContent !== output.currentContent;
  const actionLoading =
    saveMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card>
      <CardHeader
        title={TYPE_LABELS[output.type]}
        subtitle={formatDate(output.createdAt)}
        action={
          <div className="flex items-center gap-2">
            <AiOutputStatusBadge status={output.status} />
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="p-1.5 text-muted hover:text-slate-700 hover:bg-surface rounded-md transition-colors"
              aria-label="View history"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditing(false); setEditContent(output.currentContent); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!isDirty}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate(editContent)}
            >
              Save
            </Button>
            {output.status === 'pending_review' && (
              <Button
                size="sm"
                disabled={!isDirty}
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate(editContent)}
              >
                Save & Approve
              </Button>
            )}
            {(output.status === 'approved' || output.status === 'edited') && isDirty && (
              <Button
                size="sm"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate(editContent)}
              >
                Save & Re-approve
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 max-h-[32rem] overflow-y-auto pr-1">
            <MarkdownContent content={output.currentContent} />
          </div>

          {canReview && output.status === 'pending_review' && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="border-success text-success-700 hover:bg-success-50"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                loading={actionLoading}
                onClick={() => approveMutation.mutate(undefined)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-danger text-danger hover:bg-danger-50"
                leftIcon={<X className="w-3.5 h-3.5" />}
                loading={actionLoading}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </div>
          )}

          {canReview && (output.status === 'approved' || output.status === 'edited') && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={() => setEditing(true)}
              className="mt-3"
            >
              Edit
            </Button>
          )}
        </div>
      )}

      {/* History Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Edit History" size="lg">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Original (AI Generated)</h3>
            <div className="bg-surface rounded-lg p-4 max-h-60 overflow-y-auto">
              <MarkdownContent content={history?.originalContent ?? output.originalContent} />
            </div>
          </div>
          {(history?.currentContent ?? output.currentContent) !== (history?.originalContent ?? output.originalContent) && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Current</h3>
              <div className="bg-success-50 border border-success-100 rounded-lg p-4 max-h-60 overflow-y-auto">
                <MarkdownContent content={history?.currentContent ?? output.currentContent} />
              </div>
            </div>
          )}
          {history?.reviewedAt && (
            <p className="text-sm text-muted">
              Reviewed on {formatDate(history.reviewedAt)}
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
}

interface AiOutputDetailPageProps {
  appointmentId?: string;
  embedded?: boolean;
}

export function AiOutputDetailPage({ appointmentId: propAppointmentId, embedded = false }: AiOutputDetailPageProps) {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = propAppointmentId ?? params.appointmentId!;
  const role = useAuthStore((s) => s.role);
  const isStaff = role === UserRole.DOCTOR || role === UserRole.ADMIN;

  const { data: outputs, isLoading, refetch } = useQuery({
    queryKey: aiOutputKeys.byAppointment(appointmentId),
    queryFn: () => aiOutputsApi.getByAppointment(appointmentId),
    enabled: !!appointmentId,
    retry: 1,
    refetchInterval: (query) =>
      isStaff && (query.state.data?.length ?? 0) === 0 ? 5000 : false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!outputs || outputs.length === 0) {
    return (
      <div className={embedded ? 'space-y-4' : 'p-6 space-y-4'}>
        {!embedded && (
          <PageHeader
            title="AI Outputs"
            subtitle={
              isStaff
                ? 'Review AI-generated clinical documents'
                : 'Visit summaries from your doctor'
            }
          />
        )}
        {isStaff && (
          <AiGenerationStatusBanner appointmentId={appointmentId} onOutputsReady={() => void refetch()} />
        )}
        <Card>
          <div className="text-center py-10">
            <p className="text-muted">
              {isStaff
                ? 'No AI outputs generated for this appointment yet.'
                : 'No visit summary available yet.'}
            </p>
            <p className="text-sm text-muted mt-1">
              {isStaff
                ? 'Outputs are created after the consultation transcript is saved.'
                : 'Your doctor will share a summary here after reviewing your visit.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const sortedOutputs = [...outputs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 space-y-6'}>
      {!embedded && (
        <PageHeader
          title="AI Outputs"
          subtitle={`${outputs.length} outputs for this appointment`}
        />
      )}
      {isStaff && outputs.length < 4 && (
        <AiGenerationStatusBanner appointmentId={appointmentId} onOutputsReady={() => void refetch()} />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sortedOutputs.map((output) => (
          <OutputCard key={output.id} output={output} onRefresh={refetch} />
        ))}
      </div>
    </div>
  );
}
