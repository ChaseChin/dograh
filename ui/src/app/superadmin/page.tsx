"use client";

import { ArrowRight, List, Loader2 } from 'lucide-react';
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from 'react-i18next';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/lib/auth';
import { impersonateAsSuperadmin } from "@/lib/utils";

type ImpersonationTarget = "provider" | "email";

export default function SuperadminPage() {
    const [providerUserId, setProviderUserId] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState<{ target: ImpersonationTarget; message: string } | null>(null);
    const [loadingTarget, setLoadingTarget] = useState<ImpersonationTarget | null>(null);
    const { user, getAccessToken } = useAuth();
    const { t } = useTranslation();

    const handleImpersonate = async (target: ImpersonationTarget, value: string) => {
        const trimmedValue = value.trim();
        setError(null);

        if (!trimmedValue) {
            setError({
                target,
                message: target === "provider" ? t('superadmin.enterProviderId') : t('superadmin.enterEmail'),
            });
            return;
        }

        setLoadingTarget(target);

        try {
            if (!user) {
                setError({
                    target,
                    message: t('superadmin.notAuthenticated'),
                });
                return;
            }

            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError({
                    target,
                    message: t('superadmin.impersonateFailed'),
                });
                return;
            }

            await impersonateAsSuperadmin({
                accessToken: accessToken,
                ...(target === "provider"
                    ? { providerUserId: trimmedValue }
                    : { email: trimmedValue }),
                redirectPath: '/workflow',
                openInNewTab: true,
            });
        } catch (err) {
            setError({
                target,
                message: err instanceof Error ? err.message : t('superadmin.impersonateFailed'),
            });
            console.error("Impersonation error:", err);
        } finally {
            setLoadingTarget(null);
        }
    };

    const handleProviderImpersonate = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleImpersonate("provider", providerUserId);
    };

    const handleEmailImpersonate = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleImpersonate("email", email);
    };

    return (
        <>
            <main className="container mx-auto p-6 space-y-6 max-w-5xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-2">{t('superadmin.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('superadmin.subtitle')}</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('superadmin.providerCard.title')}</CardTitle>
                                <CardDescription>
                                    {t('superadmin.providerCard.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleProviderImpersonate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="providerUserId">{t('superadmin.providerCard.label')}</Label>
                                        <Input
                                            id="providerUserId"
                                            value={providerUserId}
                                            onChange={(e) => setProviderUserId(e.target.value)}
                                            placeholder={t('superadmin.providerCard.placeholder')}
                                            required
                                        />
                                    </div>

                                    {error?.target === "provider" && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                            {error.message}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={loadingTarget !== null}
                                        className="w-full"
                                    >
                                        {loadingTarget === "provider" ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {t('superadmin.processing')}
                                            </>
                                        ) : (
                                            t('superadmin.providerCard.button')
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('superadmin.emailCard.title')}</CardTitle>
                                <CardDescription>
                                    {t('superadmin.emailCard.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleEmailImpersonate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{t('superadmin.emailCard.label')}</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('superadmin.emailCard.placeholder')}
                                            required
                                        />
                                    </div>

                                    {error?.target === "email" && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                            {error.message}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={loadingTarget !== null}
                                        className="w-full"
                                    >
                                        {loadingTarget === "email" ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {t('superadmin.processing')}
                                            </>
                                        ) : (
                                            t('superadmin.emailCard.button')
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>{t('superadmin.runsCard.title')}</CardTitle>
                                <CardDescription>
                                    {t('superadmin.runsCard.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/superadmin/runs">
                                    <Button className="w-full md:w-auto">
                                        <List className="mr-2 h-4 w-4" />
                                        {t('superadmin.runsCard.button')}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                </div>
            </main>
        </>
    );
}
