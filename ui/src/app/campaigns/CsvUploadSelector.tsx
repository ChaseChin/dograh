'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { getPresignedUploadUrlApiV1S3PresignedUploadUrlPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import logger from '@/lib/logger';

interface CsvUploadSelectorProps {
  onFileUploaded: (fileKey: string, fileName: string) => void;
  selectedFileName?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function CsvUploadSelector({ onFileUploaded, selectedFileName }: CsvUploadSelectorProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error(t('campaigns.csv.selectCsv'));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('campaigns.csv.sizeLimit'));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Request presigned upload URL
      logger.info('Requesting presigned upload URL for:', file.name);
      const { data: presignedData, error } = await getPresignedUploadUrlApiV1S3PresignedUploadUrlPost({
        body: {
          file_name: file.name,
          file_size: file.size,
          content_type: 'text/csv',
        },
      });

      if (error || !presignedData) {
        throw new Error(t('campaigns.csv.uploadUrlFailed'));
      }

      logger.info('Received presigned URL, uploading file...');

      // Step 2: Upload file directly to S3/MinIO
      const uploadResponse = await fetch(presignedData.upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'text/csv',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(t('campaigns.csv.storageFailed'));
      }

      setUploadProgress(100);
      logger.info('File uploaded successfully, file_key:', presignedData.file_key);

      // Step 3: Notify parent with file_key
      onFileUploaded(presignedData.file_key, file.name);
      toast.success(t('campaigns.csv.uploaded', { name: file.name }));
    } catch (error) {
      logger.error('Error uploading CSV:', error);
      toast.error(error instanceof Error ? error.message : t('campaigns.csv.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>{t('campaigns.csv.label')}</Label>
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={uploading}
        >
          {uploading ? t('campaigns.csv.uploading', { progress: uploadProgress }) : t('campaigns.csv.uploadButton')}
        </Button>
        {selectedFileName && !uploading && (
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">{t('campaigns.csv.selected')}</span>
            <span className="text-primary">{selectedFileName}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('campaigns.csv.help')}
      </p>
    </div>
  );
}
