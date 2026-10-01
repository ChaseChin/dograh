"use client";

import * as LucideIcons from 'lucide-react';
import { Circle, ExternalLink, type LucideIcon, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from "react-i18next";

import type { NodeSpec } from '@/client/types.gen';
import { useNodeSpecs } from '@/components/flow/renderer';
import { Button } from '@/components/ui/button';
import { nodeSpecDescription, nodeSpecDisplayName } from '@/i18n/nodeSpecServerText';

import { FlowNode, NodeType } from './types';

type AddNodePanelProps = {
    isOpen: boolean;
    onClose: () => void;
    onNodeSelect: (nodeType: NodeType) => void;
    nodes: FlowNode[];
};

// Section matching and rendering order. Webhook and QA remain integration
// specs in the API, but are displayed in their own sections in this panel.
type SectionTitleKey =
    | 'flow.addNode.sections.triggers'
    | 'flow.addNode.sections.agentNodes'
    | 'flow.addNode.sections.globalNodes'
    | 'flow.addNode.sections.webhook'
    | 'flow.addNode.sections.qa'
    | 'flow.addNode.sections.integrations';

const SECTIONS: Array<{ titleKey: SectionTitleKey; matches: (spec: NodeSpec) => boolean }> = [
    { titleKey: 'flow.addNode.sections.triggers', matches: (spec) => spec.category === 'trigger' },
    { titleKey: 'flow.addNode.sections.agentNodes', matches: (spec) => spec.category === 'call_node' },
    { titleKey: 'flow.addNode.sections.globalNodes', matches: (spec) => spec.category === 'global_node' },
    { titleKey: 'flow.addNode.sections.webhook', matches: (spec) => spec.name === 'webhook' },
    { titleKey: 'flow.addNode.sections.qa', matches: (spec) => spec.name === 'qa' },
    {
        titleKey: 'flow.addNode.sections.integrations',
        matches: (spec) =>
            spec.category === 'integration' && spec.name !== 'webhook' && spec.name !== 'qa',
    },
];

function resolveIcon(name: string): LucideIcon {
    const icons = LucideIcons as unknown as Record<string, LucideIcon>;
    return icons[name] ?? Circle;
}

function NodeSection({
    title,
    specs,
    onNodeSelect,
    nodeTypeCounts,
}: {
    title: string;
    specs: NodeSpec[];
    onNodeSelect: (nodeType: NodeType) => void;
    nodeTypeCounts: Map<string, number>;
}) {
    const { t } = useTranslation();
    if (specs.length === 0) return null;
    return (
        <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="space-y-2">
                {specs.map((spec) => {
                    const Icon = resolveIcon(spec.icon);
                    const displayName = nodeSpecDisplayName(t, spec.name, spec.display_name);
                    const maxInstances = spec.graph_constraints?.max_instances;
                    const disabled =
                        maxInstances !== undefined &&
                        maxInstances !== null &&
                        (nodeTypeCounts.get(spec.name) ?? 0) >= maxInstances;
                    return (
                        <Button
                            key={spec.name}
                            variant="outline"
                            className="w-full justify-start p-4 h-auto hover:bg-accent/50 transition-colors"
                            onClick={() => onNodeSelect(spec.name as NodeType)}
                            disabled={disabled}
                            title={
                                disabled
                                    ? t("flow.addNode.limitReached", { name: displayName })
                                    : undefined
                            }
                        >
                            <div className="flex items-center">
                                <div className="bg-muted p-2 rounded-lg mr-3 border border-border">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start text-left min-w-0">
                                    <span className="font-medium text-sm">
                                        {displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-normal">
                                        {nodeSpecDescription(t, spec.name, spec.description)}
                                    </span>
                                </div>
                            </div>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

export default function AddNodePanel({ isOpen, onNodeSelect, onClose, nodes }: AddNodePanelProps) {
    const { t } = useTranslation();
    const { specs } = useNodeSpecs();

    // Group registered specs into their display sections, preserving SECTIONS order.
    const sections = useMemo(() => {
        return SECTIONS.map(({ titleKey, matches }) => ({
            title: t(titleKey),
            specs: specs.filter(matches),
        }));
    }, [specs, t]);

    const nodeTypeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        nodes.forEach((node) => {
            counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
        });
        return counts;
    }, [nodes]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <div
            className={`fixed z-51 right-0 top-0 h-full w-80 bg-background shadow-lg transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            <div className="p-4 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold">{t("flow.addNode.title")}</h2>
                        <a
                            href="https://docs.dograh.com/voice-agent/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {t("flow.addNode.viewDocs")}
                        </a>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="space-y-6">
                    {sections.map(({ title, specs }) => (
                        <NodeSection
                            key={title}
                            title={title}
                            specs={specs}
                            onNodeSelect={onNodeSelect}
                            nodeTypeCounts={nodeTypeCounts}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
