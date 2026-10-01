"use client";

import { formatDistanceToNow } from "date-fns";
import { FileDiff, FileText, LoaderCircle, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { WorkflowVersionResponse } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import { getDateFnsLocale } from "@/i18n/dateLocale";

interface VersionHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    versions: WorkflowVersionResponse[];
    loading: boolean;
    activeVersionId: number | null;
    onSelectVersion: (version: WorkflowVersionResponse) => void;
    onCompareVersion: (version: WorkflowVersionResponse) => void;
    comparingVersionId: number | null;
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
}

const statusColor: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    published: "bg-green-500/20 text-green-400 border-green-500/30",
    archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const VersionHistoryPanel = ({
    isOpen,
    onClose,
    versions,
    loading,
    activeVersionId,
    onSelectVersion,
    onCompareVersion,
    comparingVersionId,
    hasMore,
    loadingMore,
    onLoadMore,
}: VersionHistoryPanelProps) => {
    const { t } = useTranslation();

    const statusLabel: Record<string, string> = {
        draft: t("workflow.editor.versions.statusDraft"),
        published: t("workflow.editor.versions.statusPublished"),
        archived: t("workflow.editor.versions.statusArchived"),
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <div
            className={`fixed z-51 right-0 top-0 h-full w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] shadow-lg transform transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
            <div className="p-4 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-white">
                        {t("workflow.editor.versions.title")}
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("workflow.editor.versions.close")}
                        onClick={onClose}
                        className="text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <LoaderCircle className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                ) : versions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                        {t("workflow.editor.versions.empty")}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {versions.map((version, index) => {
                            const isActive = version.id === activeVersionId;
                            const date = version.published_at || version.created_at;
                            const previousVersion = versions[index + 1];
                            const canCompare = Boolean(previousVersion) || hasMore;
                            const compareLabel = previousVersion
                                ? t("workflow.editor.versions.compareWith", { version: version.version_number, previous: previousVersion.version_number })
                                : t("workflow.editor.versions.compareWithPrevious", { version: version.version_number });
                            return (
                                <div
                                    key={version.id}
                                    className={`flex w-full overflow-hidden rounded-lg border transition-colors ${
                                        isActive
                                            ? "border-teal-500/50 bg-teal-500/10"
                                            : "border-[#2a2a2a] bg-[#222]"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectVersion(version)}
                                        className="min-w-0 flex-1 cursor-pointer p-3 text-left transition-colors hover:bg-[#2a2a2a]"
                                    >
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-gray-400" />
                                                <span className="text-sm font-medium text-white">
                                                    v{version.version_number}
                                                </span>
                                            </div>
                                            {version.status !== "archived" && (
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-xs ${
                                                        statusColor[version.status] ?? ""
                                                    }`}
                                                >
                                                    {statusLabel[version.status] ?? version.status}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {formatDistanceToNow(new Date(date), {
                                                addSuffix: true,
                                                locale: getDateFnsLocale(),
                                            })}
                                        </p>
                                    </button>

                                    {canCompare && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={compareLabel}
                                            disabled={comparingVersionId !== null}
                                            onClick={() => onCompareVersion(version)}
                                            className="mr-2 h-7 w-7 shrink-0 self-center rounded-md border border-[#3a3a3a] text-gray-400 hover:bg-[#303030] hover:text-white"
                                        >
                                            {comparingVersionId === version.id ? (
                                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileDiff className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                        {hasMore && (
                            <Button
                                variant="ghost"
                                onClick={onLoadMore}
                                disabled={loadingMore}
                                className="w-full text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a]"
                            >
                                {loadingMore ? (
                                    <LoaderCircle className="w-4 h-4 animate-spin" />
                                ) : (
                                    t("workflow.editor.versions.loadMore")
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
