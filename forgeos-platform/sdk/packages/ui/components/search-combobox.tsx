"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export interface SearchComboboxOption {
	description?: string;
	icon?: ReactNode;
	label: string;
	value: string;
}

export interface SearchComboboxProps {
	align?: "start" | "end";
	ariaLabel: string;
	className?: string;
	disabled?: boolean;
	emptyText?: string;
	loading?: boolean;
	loadingText?: string;
	onValueChange: (value: string) => void;
	options: SearchComboboxOption[];
	placeholder?: string;
	placement?: "top" | "bottom";
	searchPlaceholder?: string;
	value?: string;
}

export function SearchCombobox({
	align = "start",
	ariaLabel,
	className,
	disabled = false,
	emptyText = "No results",
	loading = false,
	loadingText = "Loading…",
	onValueChange,
	options,
	placeholder = "Select",
	placement = "bottom",
	searchPlaceholder = "Search…",
	value,
}: SearchComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) {
			setSearch("");
			return;
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", handlePointerDown, true);
		return () =>
			document.removeEventListener("pointerdown", handlePointerDown, true);
	}, [open]);

	const selected = options.find((option) => option.value === value);
	const displayedValue = loading
		? loadingText
		: (selected?.label ?? value) || placeholder;
	const filtered = useMemo(() => {
		const query = search.toLowerCase();
		return options.filter((option) =>
			`${option.label} ${option.description ?? ""}`
				.toLowerCase()
				.includes(query),
		);
	}, [options, search]);

	const handleSelect = (option: SearchComboboxOption) => {
		if (disabled) return;
		if (option.value !== value) onValueChange(option.value);
		setOpen(false);
	};

	const closeAndRestoreFocus = () => {
		setOpen(false);
		triggerRef.current?.focus();
	};

	return (
		<div
			className="forgeos-ui-search-combobox relative min-w-0"
			ref={containerRef}
		>
			<button
				aria-busy={loading || undefined}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label={`${ariaLabel}: ${displayedValue}`}
				className={[
					"forgeos-ui-search-combobox__trigger inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-forgeos-ui-md border-0 bg-transparent px-2 py-1 text-forgeos-ui-sm font-forgeos-ui-medium text-forgeos-ui-foreground ease-[ease] [&:hover:not(:disabled)]:bg-forgeos-ui-surface-hover focus-visible:outline-2 focus-visible:outline-forgeos-ui-ring focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
					className,
				]
					.filter(Boolean)
					.join(" ")}
				disabled={disabled}
				onClick={() => setOpen((current) => !current)}
				ref={triggerRef}
				title={displayedValue}
				type="button"
			>
				{selected?.icon}
				<span className="forgeos-ui-search-combobox__value min-w-0 truncate">
					{displayedValue}
				</span>
			</button>

			{open ? (
				<div
					aria-label={`Search ${ariaLabel.toLowerCase()}`}
					className={[
						"forgeos-ui-search-combobox__panel absolute z-50 w-64 overflow-hidden rounded-forgeos-ui-lg border border-forgeos-ui-border bg-forgeos-ui-popover shadow-xl",
						`forgeos-ui-search-combobox__panel--${align}`,
						`forgeos-ui-search-combobox__panel--${placement}`,
						align === "start" ? "left-0" : "right-0",
						placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
					].join(" ")}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							closeAndRestoreFocus();
						}
					}}
					role="dialog"
				>
					<div className="forgeos-ui-search-combobox__search-row border-forgeos-ui-border border-b p-2">
						<div className="forgeos-ui-search-combobox__search-shell flex items-center gap-2 rounded-forgeos-ui-md bg-forgeos-ui-background px-2.5 py-1.5">
							<svg
								aria-hidden="true"
								className="forgeos-ui-search-combobox__search-icon size-3 shrink-0 text-forgeos-ui-muted-foreground"
								fill="none"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								viewBox="0 0 24 24"
							>
								<path d="m21 21-4.34-4.34" />
								<circle cx="11" cy="11" r="8" />
							</svg>
							<input
								aria-label={searchPlaceholder}
								// biome-ignore lint/a11y/noAutofocus: opening the picker focuses search
								autoFocus
								className="forgeos-ui-search-combobox__search h-auto w-full rounded-forgeos-ui-md border-0 bg-transparent p-0 text-forgeos-ui-sm text-forgeos-ui-muted-foreground outline-0 placeholder:text-forgeos-ui-muted-foreground forgeos-ui-dark:bg-forgeos-ui-input/30"
								onChange={(event) => setSearch(event.target.value)}
								placeholder={searchPlaceholder}
								value={search}
							/>
						</div>
					</div>
					<div className="forgeos-ui-search-combobox__options flex max-h-56 flex-col gap-0.5 overflow-y-auto p-1.5">
						{loading ? (
							<div className="forgeos-ui-search-combobox__empty p-2 text-forgeos-ui-sm text-forgeos-ui-muted-foreground">
								{loadingText}
							</div>
						) : filtered.length === 0 ? (
							<div className="forgeos-ui-search-combobox__empty p-2 text-forgeos-ui-sm text-forgeos-ui-muted-foreground">
								{emptyText}
							</div>
						) : (
							filtered.map((option) => (
								<button
									aria-pressed={option.value === value}
									className="forgeos-ui-search-combobox__option flex w-full cursor-pointer items-center justify-between gap-2 rounded-forgeos-ui-md border-0 bg-transparent px-2 py-1.5 text-left text-forgeos-ui-foreground transition-[background-color] duration-150 ease-[ease] [&:hover:not([aria-pressed=true])]:bg-forgeos-ui-surface-hover aria-pressed:bg-forgeos-ui-accent focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-forgeos-ui-ring motion-reduce:transition-none"
									disabled={disabled}
									key={option.value}
									onClick={() => handleSelect(option)}
									type="button"
								>
									{option.icon}
									<span className="forgeos-ui-search-combobox__option-copy flex min-w-0 flex-1 flex-col text-forgeos-ui-sm">
										<span className="truncate">{option.label}</span>
										{option.description ? (
											<small className="truncate text-[0.625rem] text-forgeos-ui-muted-foreground">
												{option.description}
											</small>
										) : null}
									</span>
									{option.value === value ? (
										<svg
											aria-hidden="true"
											className="forgeos-ui-search-combobox__check size-3 shrink-0"
											fill="none"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											viewBox="0 0 24 24"
										>
											<path d="M20 6 9 17l-5-5" />
										</svg>
									) : null}
								</button>
							))
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
