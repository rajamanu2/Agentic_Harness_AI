"use client";

import {
	Check,
	CheckCircle2,
	CircleDot,
	FileCode2,
	GitBranch,
	Hash,
	Loader2,
	RotateCw,
	ShieldCheck,
	X,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, ChatSessionStatus } from "@/lib/chat-schema";
import type { SessionFileDiff } from "@/lib/session-diff";
import {
	buildTaskEvidence,
	computeEvidenceChain,
	type TaskOutcome,
} from "@/lib/task-evidence";
import { cn } from "@/lib/utils";

type ReplayState = "idle" | "checking" | "passed" | "failed";

const TONE_CLASSES: Record<TaskOutcome["tone"], string> = {
	neutral: "border-border bg-muted/20 text-foreground",
	running: "border-sky-500/35 bg-sky-500/5 text-sky-300",
	success: "border-emerald-500/35 bg-emerald-500/5 text-emerald-300",
	warning: "border-amber-500/35 bg-amber-500/5 text-amber-300",
	danger: "border-destructive/45 bg-destructive/5 text-destructive",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
			{children}
		</div>
	);
}

function compactPath(path: string): string {
	const normalized = path.replaceAll("\\", "/").replace(/\/$/, "");
	return normalized.split("/").filter(Boolean).at(-1) || path || "No workspace";
}

export function TaskEvidencePanel({
	branch,
	fileDiffs,
	messages,
	onClose,
	sessionId,
	status,
	workspaceRoot,
}: {
	branch: string | null;
	fileDiffs: SessionFileDiff[];
	messages: ChatMessage[];
	onClose: () => void;
	sessionId: string | null;
	status: ChatSessionStatus;
	workspaceRoot: string;
}) {
	const evidence = useMemo(
		() => buildTaskEvidence({ fileDiffs, messages, status }),
		[fileDiffs, messages, status],
	);
	const [chainRoot, setChainRoot] = useState<string | null>(null);
	const [chainError, setChainError] = useState<string | null>(null);
	const [replayState, setReplayState] = useState<ReplayState>("idle");

	useEffect(() => {
		let disposed = false;
		const timeout = window.setTimeout(() => {
			void computeEvidenceChain(messages)
				.then((root) => {
					if (disposed) return;
					setChainRoot(root);
					setChainError(null);
					setReplayState("idle");
				})
				.catch((error: unknown) => {
					if (disposed) return;
					setChainError(error instanceof Error ? error.message : "Hash failed");
				});
		}, 180);
		return () => {
			disposed = true;
			window.clearTimeout(timeout);
		};
	}, [messages]);

	const replayIntegrity = async () => {
		if (!chainRoot) return;
		setReplayState("checking");
		try {
			const replayedRoot = await computeEvidenceChain(messages);
			setReplayState(replayedRoot === chainRoot ? "passed" : "failed");
		} catch {
			setReplayState("failed");
		}
	};

	const verification = evidence.verification.slice(-4).reverse();

	return (
		<aside className="forgeos-view-enter flex h-full w-[330px] max-w-[38vw] shrink-0 flex-col border-l border-border/70 bg-background/95 max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:right-0 max-[900px]:z-40 max-[900px]:max-w-[85vw]">
			<div className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4">
				<div className="flex items-center gap-2 text-sm font-medium">
					<span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
					Task evidence
				</div>
				<Button
					aria-label="Close task evidence"
					onClick={onClose}
					size="icon-sm"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			</div>

			<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
				<section>
					<SectionLabel>Outcome</SectionLabel>
					<div
						className={cn(
							"rounded-lg border p-3",
							TONE_CLASSES[evidence.outcome.tone],
						)}
					>
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
							{evidence.outcome.tone === "success" ? (
								<CheckCircle2 className="size-4" />
							) : evidence.outcome.tone === "danger" ? (
								<XCircle className="size-4" />
							) : evidence.outcome.tone === "running" ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<CircleDot className="size-4" />
							)}
							{evidence.outcome.label}
						</div>
						<p className="mt-2 text-xs leading-5 text-muted-foreground">
							{evidence.outcome.description}
						</p>
					</div>
				</section>

				<section>
					<SectionLabel>Source</SectionLabel>
					<div className="rounded-lg border border-border bg-card/45 p-3">
						<div className="flex min-w-0 items-center gap-2">
							<GitBranch className="size-4 shrink-0 text-violet-400" />
							<div className="min-w-0">
								<div
									className="truncate text-xs font-medium"
									title={workspaceRoot}
								>
									{compactPath(workspaceRoot)}
								</div>
								<div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
									{branch && branch !== "no-git"
										? branch
										: sessionId || "Session not started"}
								</div>
							</div>
						</div>
					</div>
				</section>

				<section>
					<SectionLabel>Changed files</SectionLabel>
					<div className="space-y-2">
						{evidence.changedFiles.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
								No file changes recorded yet.
							</div>
						) : (
							evidence.changedFiles.slice(0, 8).map((file) => (
								<div
									className="rounded-lg border border-border bg-card/45 p-3"
									key={file.path}
								>
									<div className="flex items-start gap-2">
										<FileCode2 className="mt-0.5 size-4 shrink-0 text-violet-400" />
										<div className="min-w-0 flex-1">
											<div className="break-all font-mono text-xs">
												{file.path}
											</div>
											<div className="mt-1 font-mono text-[10px]">
												<span className="text-emerald-400">
													+{file.additions}
												</span>{" "}
												<span className="text-rose-400">-{file.deletions}</span>
											</div>
										</div>
									</div>
								</div>
							))
						)}
						{evidence.changedFiles.length > 8 ? (
							<div className="px-1 text-[11px] text-muted-foreground">
								+{evidence.changedFiles.length - 8} more files
							</div>
						) : null}
					</div>
				</section>

				<section>
					<SectionLabel>Verification</SectionLabel>
					<div className="space-y-2">
						{verification.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
								No build, test, lint, typecheck, or validation command captured
								yet.
							</div>
						) : (
							verification.map((check) => (
								<div
									className={cn(
										"rounded-lg border p-3",
										check.state === "passed"
											? "border-emerald-500/30 bg-emerald-500/5"
											: check.state === "failed"
												? "border-destructive/40 bg-destructive/5"
												: "border-sky-500/30 bg-sky-500/5",
									)}
									key={`${check.messageId}:${check.command}`}
								>
									<div className="flex items-center gap-2 text-xs font-medium">
										{check.state === "passed" ? (
											<Check className="size-4 text-emerald-400" />
										) : check.state === "failed" ? (
											<XCircle className="size-4 text-destructive" />
										) : (
											<Loader2 className="size-4 animate-spin text-sky-400" />
										)}
										{check.state === "passed"
											? "Passed"
											: check.state === "failed"
												? "Failed"
												: "Running"}
									</div>
									<div className="mt-2 break-all font-mono text-[10px] leading-4 text-muted-foreground">
										$ {check.command}
									</div>
								</div>
							))
						)}
					</div>
				</section>

				<section>
					<SectionLabel>Ledger</SectionLabel>
					<div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
						<div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
							<ShieldCheck className="size-4" />
							{status === "completed" ||
							status === "cancelled" ||
							status === "failed" ||
							status === "error"
								? "Hash chain sealed"
								: "Hash chain live"}
						</div>
						<div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
							<Hash className="size-3" />
							<span
								className="truncate"
								title={chainRoot ?? chainError ?? "Computing SHA-256 chain"}
							>
								{chainRoot
									? `${chainRoot.slice(0, 18)}…`
									: (chainError ?? "Computing…")}
							</span>
						</div>
						<div className="mt-1 text-[10px] text-muted-foreground">
							{messages.length} {messages.length === 1 ? "event" : "events"} ·
							SHA-256
						</div>
					</div>
					<Button
						className="mt-2 w-full gap-2"
						disabled={!chainRoot || replayState === "checking"}
						onClick={() => void replayIntegrity()}
						size="sm"
						variant="secondary"
					>
						{replayState === "checking" ? (
							<Loader2 className="size-3 animate-spin" />
						) : replayState === "passed" ? (
							<Check className="size-3 text-emerald-400" />
						) : replayState === "failed" ? (
							<XCircle className="size-3 text-destructive" />
						) : (
							<RotateCw className="size-3" />
						)}
						{replayState === "passed"
							? "Replay integrity passed"
							: replayState === "failed"
								? "Replay integrity failed"
								: "Replay integrity check"}
					</Button>
				</section>
			</div>
		</aside>
	);
}
