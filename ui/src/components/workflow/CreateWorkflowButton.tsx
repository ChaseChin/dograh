'use client';

import { Bot, ChevronDown, LayoutTemplate, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { createWorkflowApiV1WorkflowCreateDefinitionPost } from '@/client/sdk.gen';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AgentLanguage,
    buildBlankWorkflowDefinition,
    DEFAULT_AGENT_LANGUAGE,
} from '@/components/workflow/blank-workflow-definition';
import { LanguageNotice } from '@/components/workflow/LanguageNotice';
import { detailFromError } from '@/lib/apiError';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { getRandomId } from '@/lib/utils';

export function CreateWorkflowButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user, getAccessToken } = useAuth();
    const [isCreating, setIsCreating] = useState(false);
    const [isBlankDialogOpen, setIsBlankDialogOpen] = useState(false);
    const [language, setLanguage] = useState<AgentLanguage>(DEFAULT_AGENT_LANGUAGE);

    const handleAgentBuilder = () => {
        router.push('/workflow/create');
    };

    const handleBlankCanvas = async () => {
        if (isCreating || !user) return;
        setIsCreating(true);

        try {
            const accessToken = await getAccessToken();
            const name = `Workflow-${getRandomId()}`;
            const response = await createWorkflowApiV1WorkflowCreateDefinitionPost({
                body: {
                    name,
                    language,
                    workflow_definition: buildBlankWorkflowDefinition(language) as unknown as { [key: string]: unknown },
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.error) {
                logger.error(`Error creating blank workflow: ${JSON.stringify(response.error)}`);
                toast.error(detailFromError(response.error, t('workflowList.create.createFailed')));
                return;
            }

            if (response.data?.id) {
                setIsBlankDialogOpen(false);
                router.push(`/workflow/${response.data.id}`);
            }
        } catch (err) {
            logger.error(`Error creating blank workflow: ${err}`);
            toast.error(t('workflowList.create.createFailed'));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={isCreating}>
                        <PlusIcon className="w-4 h-4" />
                        {isCreating ? t('workflow.create.creating') : t('workflow.create.createAgent')}
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleAgentBuilder} className="cursor-pointer">
                        <Bot className="w-4 h-4 mr-2" />
                        <div>
                            <div className="font-medium">{t('workflowList.create.useAgentBuilder')}</div>
                            <div className="text-xs text-muted-foreground">{t('workflowList.create.useAgentBuilderDesc')}</div>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsBlankDialogOpen(true)} disabled={isCreating} className="cursor-pointer">
                        <LayoutTemplate className="w-4 h-4 mr-2" />
                        <div>
                            <div className="font-medium">{t('workflowList.create.blankCanvas')}</div>
                            <div className="text-xs text-muted-foreground">{t('workflowList.create.blankCanvasDesc')}</div>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* A blank canvas is created with an opening prompt in the agent's
                language, so the language is chosen up front. */}
            <Dialog open={isBlankDialogOpen} onOpenChange={setIsBlankDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('workflow.language.blankTitle')}</DialogTitle>
                        <DialogDescription>{t('workflow.language.blankDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="blank-language">{t('workflow.language.label')}</Label>
                        <Select value={language} onValueChange={(value) => setLanguage(value as AgentLanguage)}>
                            <SelectTrigger id="blank-language">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="zh">{t('workflow.language.zh')}</SelectItem>
                                <SelectItem value="en">{t('workflow.language.en')}</SelectItem>
                                <SelectItem value="auto">{t('workflow.language.auto')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">{t('workflow.language.help')}</p>
                        <LanguageNotice language={language} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBlankDialogOpen(false)} disabled={isCreating}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleBlankCanvas} disabled={isCreating}>
                            {isCreating ? t('workflow.create.creating') : t('workflowList.create.blankCanvas')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
