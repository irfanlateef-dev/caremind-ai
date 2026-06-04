import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, Input, Select, Modal, ModalFooter, FileUpload } from '@/components/ui';
import { documentsApi, documentKeys } from '@/api/documents.api';
import { getApiErrorMessage } from '@/api/errors';

const uploadSchema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  appointmentId: z.string().optional(),
  documentType: z.string().optional(),
});
type UploadFormValues = z.infer<typeof uploadSchema>;

export interface SelectOption {
  value: string;
  label: string;
}

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, patient is fixed and hidden */
  fixedPatientId?: string;
  /** When set, appointment is fixed and hidden */
  fixedAppointmentId?: string;
  patientOptions?: SelectOption[];
  appointmentOptions?: SelectOption[];
  onSuccess?: () => void;
}

export function DocumentUploadModal({
  open,
  onClose,
  fixedPatientId,
  fixedAppointmentId,
  patientOptions = [],
  appointmentOptions = [],
  onSuccess,
}: DocumentUploadModalProps) {
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      patientId: fixedPatientId ?? '',
      appointmentId: fixedAppointmentId ?? '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (fixedPatientId) setValue('patientId', fixedPatientId);
    if (fixedAppointmentId) setValue('appointmentId', fixedAppointmentId);
  }, [open, fixedPatientId, fixedAppointmentId, setValue]);

  const uploadMutation = useMutation({
    mutationFn: (values: UploadFormValues) => {
      const patientId = fixedPatientId ?? values.patientId;
      const appointmentId =
        fixedAppointmentId || (values.appointmentId?.trim() ? values.appointmentId : undefined);
      return documentsApi.upload({
        files: selectedFiles,
        patientId,
        appointmentId,
        documentType: values.documentType,
      });
    },
    onSuccess: (result) => {
      const n = result.documents.length;
      const failed = result.failed.length;
      if (failed > 0) {
        toast.success(
          `${n} file${n === 1 ? '' : 's'} uploaded — ${failed} failed. Processing in background.`,
        );
      } else {
        toast.success(
          `${n} file${n === 1 ? '' : 's'} uploaded — processing in background`,
        );
      }
      handleClose();
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      onSuccess?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  });

  const handleClose = () => {
    onClose();
    reset({
      patientId: fixedPatientId ?? '',
      appointmentId: fixedAppointmentId ?? '',
      documentType: '',
    });
    setSelectedFiles([]);
  };

  const showPatientSelect = !fixedPatientId && patientOptions.length > 0;
  const showAppointmentSelect = !fixedAppointmentId && appointmentOptions.length > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Upload Documents">
      <form
        onSubmit={handleSubmit((v) => {
          if (!selectedFiles.length) {
            toast.error('Please select a file');
            return;
          }
          uploadMutation.mutate(v);
        })}
        className="space-y-4"
      >
        <FileUpload
          onFilesSelected={setSelectedFiles}
          accept=".pdf,.jpg,.jpeg,.png"
          maxSizeMB={20}
          multiple
        />
        {showPatientSelect && (
          <Select
            label="Patient"
            options={patientOptions}
            error={errors.patientId?.message}
            required
            {...register('patientId')}
          />
        )}
        {fixedPatientId && <input type="hidden" {...register('patientId')} />}
        {showAppointmentSelect && (
          <Select
            label="Appointment (optional)"
            options={[{ value: '', label: 'No specific appointment' }, ...appointmentOptions]}
            {...register('appointmentId')}
          />
        )}
        {fixedAppointmentId && <input type="hidden" {...register('appointmentId')} />}
        <Input
          label="Document Type"
          placeholder="e.g. Lab Report, X-Ray, Prescription"
          {...register('documentType')}
        />
        <ModalFooter>
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={uploadMutation.isPending} disabled={!selectedFiles.length}>
            Upload{selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
