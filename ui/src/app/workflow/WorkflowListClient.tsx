"use client";

import { useTranslation } from "react-i18next";

import type { FolderResponse, WorkflowListResponse } from '@/client/types.gen';
import { Card, CardContent } from '@/components/ui/card';
import { CreateWorkflowButton } from "@/components/workflow/CreateWorkflowButton";
import { AgentFolderView } from '@/components/workflow/folders/AgentFolderView';
import { CreateFolderButton } from '@/components/workflow/folders/CreateFolderButton';
import { FolderSection } from '@/components/workflow/folders/FolderSection';
import { UploadWorkflowButton } from '@/components/workflow/UploadWorkflowButton';

export function WorkflowAuthRequired() {
    const { t } = useTranslation();
    return (
        <div className="text-red-500">
            {t('workflow.list.authRequired')}
        </div>
    );
}

export function WorkflowLoadFailed() {
    const { t } = useTranslation();
    return (
        <div className="text-red-500">
            {t('workflow.list.loadFailed')}
        </div>
    );
}

export function WorkflowListView({
    activeWorkflows,
    folders,
    archivedWorkflows,
}: {
    activeWorkflows: WorkflowListResponse[];
    folders: FolderResponse[];
    archivedWorkflows: WorkflowListResponse[];
}) {
    const { t } = useTranslation();
    return (
        <>
            {/* Active Workflows Section */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">{t('workflow.list.activeAgents')}</h2>
                {activeWorkflows.length > 0 || folders.length > 0 ? (
                    <AgentFolderView workflows={activeWorkflows} folders={folders} />
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            {t('workflow.list.emptyActive')}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Archived Section — collapsible, same design as the folder/Uncategorized sections */}
            {archivedWorkflows.length > 0 && (
                <div className="mb-8">
                    <FolderSection kind="archived" workflows={archivedWorkflows} />
                </div>
            )}
        </>
    );
}

export function WorkflowsPageShell({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <div className="container mx-auto px-4 py-8">
            {/* Your Workflows Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t('workflow.list.yourAgents')}</h1>
                    <div className="flex gap-2">
                        <UploadWorkflowButton />
                        <CreateFolderButton />
                        <CreateWorkflowButton />
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
