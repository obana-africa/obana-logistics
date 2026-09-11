"use client";

import React from "react";
import { ArrowUpDown, Scale } from "lucide-react";
import { LocationInput } from "@/components/LocationInput";
import { Button, Input, Select } from "@/components/ui";
import { CURRENCIES, MAX_KG, MIN_KG, WEIGHT_CHIPS, type Place } from "./quote";

export type QuoteErrors = Partial<Record<"origin" | "destination" | "weight", string>>;

export const QUOTE_FORM_ID = "quote-form";

const display = { fontFamily: "var(--font-display)" } as const;

interface QuoteFormProps {
	origin: Place;
	destination: Place;
	weight: string;
	/** "" means automatic (from the pickup country). */
	currencyChoice: string;
	autoCurrency: string;
	errors: QuoteErrors;
	loading: boolean;
	onOrigin: (p: Place) => void;
	onDestination: (p: Place) => void;
	onSwap: () => void;
	onWeight: (v: string) => void;
	onCurrency: (v: string) => void;
	onSubmit: (e: React.FormEvent) => void;
}

export function QuoteForm(props: QuoteFormProps) {
	const { origin, destination, weight, currencyChoice, autoCurrency, errors, loading } = props;
	const kg = parseFloat(weight);

	return (
		<form
			id={QUOTE_FORM_ID}
			onSubmit={props.onSubmit}
			noValidate
			aria-labelledby="quote-form-title"
			className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6"
		>
			<h2 id="quote-form-title" className="text-lg font-bold text-slate-900" style={display}>
				Shipment details
			</h2>
			<p className="mt-0.5 text-sm text-slate-500">Where it starts, where it goes and how heavy it is.</p>

			{/* LocationInput uses three columns from `sm` up; in this column give the country its own row, then state and city side by side. */}
			<div className="mt-5 sm:[&_fieldset>.grid]:grid-cols-2 sm:[&_fieldset>.grid>*:first-child]:col-span-2">
				<div data-invalid={errors.origin ? "true" : undefined}>
					<LocationInput label="From" value={origin} onChange={props.onOrigin} required defaultCountryCode="GB" placeholder="Pickup city" />
					{errors.origin && <p className="mt-1.5 text-sm text-rose-600">{errors.origin}</p>}
				</div>

				<div className="my-3 flex items-center">
					<span className="h-px flex-1 bg-slate-200" aria-hidden />
					<button
						type="button"
						onClick={props.onSwap}
						aria-label="Swap From and To"
						title="Swap From and To"
						className="mx-3 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#1B3B5F]/40 hover:text-[#1B3B5F] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20"
					>
						<ArrowUpDown className="h-4 w-4" aria-hidden />
					</button>
					<span className="h-px flex-1 bg-slate-200" aria-hidden />
				</div>

				<div data-invalid={errors.destination ? "true" : undefined}>
					<LocationInput label="To" value={destination} onChange={props.onDestination} required defaultCountryCode="NG" placeholder="Delivery city" />
					{errors.destination && <p className="mt-1.5 text-sm text-rose-600">{errors.destination}</p>}
				</div>
			</div>

			<div className="mt-6" data-invalid={errors.weight ? "true" : undefined}>
				<Input
					label="Weight (kg)"
					type="number"
					inputMode="decimal"
					step="0.1"
					min={MIN_KG}
					max={MAX_KG}
					placeholder="e.g. 4.5"
					required
					value={weight}
					onChange={(e) => props.onWeight(e.target.value)}
					error={errors.weight}
				/>
				<div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Common weights">
					{WEIGHT_CHIPS.map((chip) => {
						const active = kg === chip;
						return (
							<button
								key={chip}
								type="button"
								aria-pressed={active}
								onClick={() => props.onWeight(String(chip))}
								className={
									active
										? "h-10 rounded-full border border-[#1B3B5F] bg-[#1B3B5F] px-4 text-sm font-semibold text-white"
										: "h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#1B3B5F]/40 hover:bg-slate-50"
								}
							>
								{chip} kg
							</button>
						);
					})}
				</div>
				<p className="mt-3 flex gap-2 text-xs leading-relaxed text-slate-500">
					<Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
					<span>No parcel scale? Stand on a bathroom scale holding the packed box, then without it — the difference is its weight.</span>
				</p>
			</div>

			<div className="mt-6">
				<Select
					label="Show prices in"
					options={CURRENCIES}
					placeholder={`Automatic (${autoCurrency})`}
					value={currencyChoice}
					onChange={(e) => props.onCurrency(e.target.value)}
					helperText="You're charged in naira (NGN)."
				/>
			</div>

			{/* Phones use the sticky button at the bottom of the screen instead. */}
			<div className="mt-6 hidden md:block">
				<Button type="submit" size="lg" fullWidth loading={loading}>
					{loading ? "Getting prices…" : "Get quote"}
				</Button>
			</div>
		</form>
	);
}
