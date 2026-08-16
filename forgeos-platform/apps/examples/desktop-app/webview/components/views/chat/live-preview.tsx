"use client";

import { ExternalLink, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { openExternalUrl } from "@/lib/desktop-client";

export function LivePreview({ url, onClose }: { url: string; onClose: () => void }) {
	const [reloadKey, setReloadKey] = useState(0);

	return (
		<section className="flex h-full min-h-0 flex-col bg-background" aria-label="Live app preview">
			<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
				<span className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
					{url}
				</span>
				<Button aria-label="Reload preview" onClick={() => setReloadKey((key) => key + 1)} size="icon-sm" variant="ghost">
					<RefreshCw className="size-4" />
				</Button>
				<Button aria-label="Open preview in browser" onClick={() => void openExternalUrl(url)} size="icon-sm" variant="ghost">
					<ExternalLink className="size-4" />
				</Button>
				<Button aria-label="Close preview" onClick={onClose} size="icon-sm" variant="ghost">
					<X className="size-4" />
				</Button>
			</div>
			<iframe
				className="min-h-0 flex-1 border-0 bg-white"
				key={reloadKey}
				src={url}
				title="ForgeOS live app preview"
			/>
		</section>
	);
}
