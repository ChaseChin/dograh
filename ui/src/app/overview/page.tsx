"use client";

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

export default function OverviewPage() {
    const { t } = useTranslation();
    const { user, provider } = useAuth();
    const isOSSMode = provider !== 'stack';
    const firstName = user?.displayName?.split(' ')[0];

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Welcome Card */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-3xl">
                            {isOSSMode
                                ? t("overview.welcomeOss")
                                : firstName
                                  ? t("overview.welcomeNamed", { name: firstName })
                                  : t("overview.welcome")}
                        </CardTitle>
                        <CardDescription className="text-lg mt-2">
                            {isOSSMode
                                ? t("overview.subtitleOss")
                                : t("overview.subtitleCloud")}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("overview.agentsTitle")}</CardTitle>
                            <CardDescription>
                                {t("overview.agentsDesc")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link href="/workflow">
                                    {t("overview.goToAgents")}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("overview.servicesTitle")}</CardTitle>
                            <CardDescription>
                                {t("overview.servicesDesc")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline">
                                <Link href="/model-configurations">
                                    {t("overview.configureModels")}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Resources Section */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>{t("overview.resourcesTitle")}</CardTitle>
                        <CardDescription>
                            {t("overview.resourcesDesc")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <Button asChild variant="outline">
                                <a
                                    href="https://docs.dograh.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t("overview.documentation")}
                                </a>
                            </Button>
                            <Button asChild variant="outline">
                                <a
                                    href="https://github.com/dograh-hq/dograh/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t("overview.reportIssue")}
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
