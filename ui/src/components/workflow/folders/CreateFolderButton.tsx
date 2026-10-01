'use client';

import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { createFolderApiV1FolderPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';

import { FolderFormDialog } from './FolderFormDialog';

export function CreateFolderButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const handleCreate = async (name: string) => {
        const response = await createFolderApiV1FolderPost({ body: { name } });
        if (response.error) {
            // 409 = duplicate name; surface the server's message when present.
            const detail =
                (response.error as { detail?: string })?.detail ??
                t('workflowList.folders.createFailed');
            toast.error(detail);
            throw new Error(detail);
        }
        toast.success(t('workflowList.folders.created', { name }));
        router.refresh();
    };

    return (
        <>
            <Button variant="outline" onClick={() => setIsOpen(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                {t('workflowList.folders.newFolder')}
            </Button>
            <FolderFormDialog
                open={isOpen}
                onOpenChange={setIsOpen}
                title={t('workflowList.folders.createDialogTitle')}
                submitLabel={t('common.create')}
                onSubmit={handleCreate}
            />
        </>
    );
}
