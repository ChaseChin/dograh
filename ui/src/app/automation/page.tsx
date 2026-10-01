"use client";

import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AutomationPage() {
    const { t } = useTranslation();
    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">{t('automation.title')}</h1>
                <p>{t('automation.subtitle')}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('automation.comingSoon')}</CardTitle>
                    <CardDescription>
                        {t('automation.underDevelopment')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <Zap className="w-16 h-16 mx-auto mb-6" />
                        <p className="text-lg mb-4">
                            {t('automation.workingOn')}
                        </p>
                        <p>
                            {t('automation.description')}
                        </p>
                        <p className="mt-4">
                            {t('automation.checkBack')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
