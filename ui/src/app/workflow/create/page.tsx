'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';

export default function CreateWorkflowPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user, getAccessToken } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [workflowId, setWorkflowId] = useState<string | null>(null);

    const [callType, setCallType] = useState<'inbound' | 'outbound'>('inbound');
    const [useCase, setUseCase] = useState('');
    const [activityDescription, setActivityDescription] = useState('');

    const handleCreateWorkflow = async () => {
        if (!useCase || !activityDescription) {
            setError(t('workflow.create.fillAllFields'));
            return;
        }

        if (!user) {
            setError(t('workflow.create.mustBeLoggedIn'));
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const accessToken = await getAccessToken();

            // Call the API to create workflow from template
            const response = await createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost({
                body: {
                    call_type: callType,
                    use_case: useCase,
                    activity_description: activityDescription,
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.data?.id) {
                setWorkflowId(String(response.data.id));
                setShowSuccessModal(true);
            }
        } catch (err) {
            setError(t('workflow.create.createFailed'));
            logger.error(`Error creating workflow: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalContinue = () => {
        if (!workflowId) return;
        router.push(`/workflow/${workflowId}?onboarding=web_call`);
    };

    return (
        <div className="min-h-screen">
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">{t('workflow.create.title')}</h1>
                    <p className="text-muted-foreground">
                        {t('workflow.create.subtitle')}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('workflow.create.cardTitle')}</CardTitle>
                        <CardDescription>
                            {t('workflow.create.cardDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="call-type">{t('workflow.create.callType')}</Label>
                            <Select value={callType} onValueChange={(value) => setCallType(value as 'inbound' | 'outbound')}>
                                <SelectTrigger id="call-type">
                                    <SelectValue placeholder={t('workflow.create.callTypePlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inbound">
                                        {t('workflow.create.callTypeInbound')}
                                    </SelectItem>
                                    <SelectItem value="outbound">
                                        {t('workflow.create.callTypeOutbound')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                {t('workflow.create.callTypeHelp')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="use-case">{t('workflow.create.useCase')}</Label>
                            <Input
                                id="use-case"
                                placeholder={t('workflow.create.useCasePlaceholder')}
                                value={useCase}
                                onChange={(e) => setUseCase(e.target.value)}
                            />
                            <p className="text-sm text-muted-foreground">
                                {t('workflow.create.useCaseHelp')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="activity-description">{t('workflow.create.activityDescription')}</Label>
                            <Textarea
                                id="activity-description"
                                placeholder={t('workflow.create.activityPlaceholder')}
                                value={activityDescription}
                                onChange={(e) => setActivityDescription(e.target.value)}
                                className="min-h-[100px]"
                            />
                            <p className="text-sm text-muted-foreground">
                                {t('workflow.create.activityHelp')}
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}

                        <div className="pt-4">
                            <Button
                                onClick={handleCreateWorkflow}
                                disabled={isLoading || !useCase || !activityDescription}
                                className="w-full"
                            >
                                {isLoading ? t('workflow.create.creating') : t('workflow.create.createAgent')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md p-8">
                        <div className="flex flex-col items-center space-y-6">
                            {/* Animated spinner */}
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold">
                                    {t('workflow.create.creatingTitle')}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    {t('workflow.create.creatingBody')}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Success Modal */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('workflow.create.successTitle')}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="mt-4 space-y-3">
                                <p>
                                    {t('workflow.create.successP1')}
                                </p>
                                <p>
                                    {t('workflow.create.successP2')}
                                </p>
                                <p>
                                    {t('workflow.create.successP3')}
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6">
                        <Button
                            onClick={handleModalContinue}
                            className="w-full"
                        >
                            {t('workflow.create.openAndTest')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
