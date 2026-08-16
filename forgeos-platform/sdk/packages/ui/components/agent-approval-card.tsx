"use client";

import { type ReactNode, useId } from "react";

export type AgentApprovalAction = "approve" | "reject";

export interface AgentApprovalCardProps {
	description?: ReactNode;
	detail?: ReactNode;
	error?: ReactNode;
	meta?: ReactNode;
	onApprove: () => void;
	onReject: () => void;
	responding?: AgentApprovalAction;
	title: ReactNode;
}

function Spinner() {
	return (
		<svg
			aria-hidden="true"
			className="forgeos-ui-agent-approval-card__spinner mr-1 size-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] stroke-2"
			viewBox="0 0 24 24"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	);
}

export function AgentApprovalCard({
	description,
	detail,
	error,
	meta,
	onApprove,
	onReject,
	responding,
	title,
}: AgentApprovalCardProps) {
	const titleId = useId();
	const isPending = responding !== undefined;

	return (
		<section
			aria-busy={isPending || undefined}
			aria-labelledby={titleId}
			className="forgeos-ui-agent-approval-card rounded-forgeos-ui-lg border border-forgeos-ui-border/80 bg-forgeos-ui-background/70 p-3"
		>
			<div className="forgeos-ui-agent-approval-card__header flex items-center justify-between gap-2">
				<div
					className="forgeos-ui-agent-approval-card__title font-forgeos-ui-medium text-forgeos-ui-foreground text-forgeos-ui-sm"
					id={titleId}
				>
					{title}
				</div>
				{meta ? (
					<div className="forgeos-ui-agent-approval-card__meta inline-flex items-center gap-1 text-[11px] text-forgeos-ui-muted-foreground">
						{meta}
					</div>
				) : null}
			</div>
			{description ? (
				<div className="forgeos-ui-agent-approval-card__description mt-1 text-[11px] text-forgeos-ui-muted-foreground">
					{description}
				</div>
			) : null}
			{detail != null ? (
				<pre className="forgeos-ui-agent-approval-card__detail max-h-44 max-w-full">
					{detail}
				</pre>
			) : null}
			{error ? (
				<div className="forgeos-ui-agent-approval-card__error">{error}</div>
			) : null}
			<div className="forgeos-ui-agent-approval-card__actions">
				<button
					className="forgeos-ui-agent-approval-card__button forgeos-ui-agent-approval-card__button--approve inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-forgeos-ui-md border-0 bg-forgeos-ui-primary px-3 font-forgeos-ui-medium text-forgeos-ui-primary-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-forgeos-ui-primary/90 focus-visible:outline-3 focus-visible:outline-forgeos-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50"
					disabled={isPending}
					onClick={onApprove}
					type="button"
				>
					{responding === "approve" ? (
						<>
							<Spinner />
							Approving...
						</>
					) : (
						"Approve"
					)}
				</button>
				<button
					className="forgeos-ui-agent-approval-card__button forgeos-ui-agent-approval-card__button--reject inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-forgeos-ui-md border border-forgeos-ui-border bg-forgeos-ui-background px-3 font-forgeos-ui-medium text-forgeos-ui-foreground shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-forgeos-ui-accent [&:hover]:text-forgeos-ui-accent-foreground focus-visible:outline-3 focus-visible:outline-forgeos-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50 forgeos-ui-dark:border-forgeos-ui-input forgeos-ui-dark:bg-forgeos-ui-input/30 forgeos-ui-dark:[&:hover]:bg-forgeos-ui-input/50"
					disabled={isPending}
					onClick={onReject}
					type="button"
				>
					{responding === "reject" ? (
						<>
							<Spinner />
							Rejecting...
						</>
					) : (
						"Reject"
					)}
				</button>
			</div>
		</section>
	);
}
