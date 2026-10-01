'use client';

import {
    Archive,
    Check,
    Folder as FolderIcon,
    FolderInput,
    Inbox,
    Pencil,
    RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    moveWorkflowToFolderApiV1WorkflowWorkflowIdFolderPut,
    updateWorkflowStatusApiV1WorkflowWorkflowIdStatusPut,
} from '@/client/sdk.gen';
import type { FolderResponse } from '@/client/types.gen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';
import { formatDate } from '@/lib/dateTime';

interface Workflow {
    id: number;
    name: string;
    status: string;
    created_at: string;
    total_runs?: number | null;
    folder_id?: number | null;
}

interface WorkflowTableProps {
    workflows: Workflow[];
    showArchived: boolean;
    /**
     * When provided, each row gets a "Move to folder" action listing these
     * folders. Omit it (e.g. for the archived list) to hide the control.
     */
    folders?: FolderResponse[];
    /** The folder this table is rendered under; null means "Uncategorized". */
    currentFolderId?: number | null;
}

export function WorkflowTable({
    workflows,
    showArchived,
    folders,
    currentFolderId = null,
}: WorkflowTableProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const organizationTimezone = useOrganizationTimezone();
    const [isPending, startTransition] = useTransition();
    const [loadingWorkflowId, setLoadingWorkflowId] = useState<number | null>(null);
    const [movingWorkflowId, setMovingWorkflowId] = useState<number | null>(null);

    const handleEdit = (id: number) => {
        router.push(`/workflow/${id}`);
    };

    const handleArchiveToggle = async (id: number, currentStatus: string) => {
        const isArchiving = currentStatus === 'active';
        const newStatus = isArchiving ? 'archived' : 'active';
        const action = isArchiving ? 'Archive' : 'Restore';

        setLoadingWorkflowId(id);

        try {
            const response = await updateWorkflowStatusApiV1WorkflowWorkflowIdStatusPut({
                path: {
                    workflow_id: id,
                },
                body: {
                    status: newStatus,
                },
            });

            if (response.data) {
                toast.success(
                    isArchiving
                        ? t('workflowList.table.archiveSuccess')
                        : t('workflowList.table.restoreSuccess'),
                );
                startTransition(() => {
                    router.refresh();
                });
            }
        } catch (error) {
            console.error(`Error ${action.toLowerCase()}ing workflow:`, error);
            toast.error(
                isArchiving
                    ? t('workflowList.table.archiveFailed')
                    : t('workflowList.table.restoreFailed'),
            );
        } finally {
            setLoadingWorkflowId(null);
        }
    };

    const handleMove = async (id: number, folderId: number | null) => {
        setMovingWorkflowId(id);
        try {
            const response = await moveWorkflowToFolderApiV1WorkflowWorkflowIdFolderPut({
                path: { workflow_id: id },
                body: { folder_id: folderId },
            });
            if (response.error) {
                throw new Error('Failed to move agent');
            }
            toast.success(
                folderId === null
                    ? t('workflowList.table.movedToUncategorized')
                    : t('workflowList.table.moveSuccess'),
            );
            startTransition(() => {
                router.refresh();
            });
        } catch (error) {
            console.error('Error moving workflow:', error);
            toast.error(t('workflowList.table.moveFailed'));
        } finally {
            setMovingWorkflowId(null);
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-semibold">ID</TableHead>
                            <TableHead className="font-semibold">{t('workflowList.table.headerName')}</TableHead>
                            <TableHead className="font-semibold">{t('workflowList.table.headerCreatedAt')}</TableHead>
                            <TableHead className="font-semibold text-center">{t('workflowList.table.headerTotalRuns')}</TableHead>
                            <TableHead className="font-semibold text-right">{t('workflowList.table.headerActions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((workflow) => (
                            <TableRow
                                key={workflow.id}
                                className={`hover:bg-accent transition-colors ${showArchived ? 'opacity-60' : ''}`}
                            >
                                <TableCell className="text-muted-foreground">
                                    {workflow.id}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {workflow.name}
                                </TableCell>
                                <TableCell>
                                    {formatDate(workflow.created_at, organizationTimezone)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-sm font-semibold bg-muted rounded-full">
                                        {workflow.total_runs || 0}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(workflow.id)}
                                            className="flex items-center gap-2"
                                        >
                                            <Pencil size={16} />
                                            {t('common.edit')}
                                        </Button>
                                        {folders && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={movingWorkflowId === workflow.id || isPending}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {movingWorkflowId === workflow.id ? (
                                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                        ) : (
                                                            <FolderInput size={16} />
                                                        )}
                                                        {t('workflowList.table.move')}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel>{t('workflowList.table.moveToFolder')}</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={currentFolderId === null}
                                                        onClick={() => handleMove(workflow.id, null)}
                                                    >
                                                        <Inbox size={14} className="mr-2" />
                                                        {t('workflowList.table.uncategorized')}
                                                        {currentFolderId === null && (
                                                            <Check size={14} className="ml-auto" />
                                                        )}
                                                    </DropdownMenuItem>
                                                    {folders.map((folder) => (
                                                        <DropdownMenuItem
                                                            key={folder.id}
                                                            disabled={folder.id === currentFolderId}
                                                            onClick={() => handleMove(workflow.id, folder.id)}
                                                        >
                                                            <FolderIcon size={14} className="mr-2" />
                                                            <span className="truncate">{folder.name}</span>
                                                            {folder.id === currentFolderId && (
                                                                <Check size={14} className="ml-auto shrink-0" />
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                        <Button
                                            variant={showArchived ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleArchiveToggle(workflow.id, workflow.status)}
                                            disabled={loadingWorkflowId === workflow.id || isPending}
                                            className="flex items-center gap-2"
                                        >
                                            {loadingWorkflowId === workflow.id ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                    {showArchived ? t('workflowList.table.restoring') : t('workflowList.table.archiving')}
                                                </>
                                            ) : (
                                                <>
                                                    {showArchived ? (
                                                        <>
                                                            <RotateCcw size={16} />
                                                            {t('workflowList.table.restore')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Archive size={16} />
                                                            {t('workflowList.table.archive')}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
