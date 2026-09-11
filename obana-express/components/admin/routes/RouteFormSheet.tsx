"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { LocationInput } from "@/components/LocationInput";
import { Sheet } from "./Sheet";
import {
	SERVICE_LEVELS,
	TRANSPORT_MODES,
	buildPayload,
	calculateUnitPrice,
	driverLabel,
	formFromRoute,
	formatPerKg,
	newBracket,
	routeTitle,
	validateRoute,
	type BracketDraft,
	type DriverSummary,
	type RouteForm,
	type RoutePayload,
	type RouteTemplate,
} from "./model";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
	return (
		<section className="space-y-4 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
			<div>
				<h3 className="font-semibold text-slate-900">{title}</h3>
				{description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
			</div>
			{children}
		</section>
	);
}

export function RouteFormSheet({
	route,
	drivers,
	driversError,
	saving,
	serverError,
	onCancel,
	onSave,
}: {
	route: RouteTemplate | null;
	drivers: DriverSummary[];
	driversError: boolean;
	saving: boolean;
	serverError: string;
	onCancel: () => void;
	onSave: (payload: RoutePayload) => void;
}) {
	const [form, setForm] = useState<RouteForm>(() => formFromRoute(route));
	const [showErrors, setShowErrors] = useState(false);

	const errors = validateRoute(form);
	const shown = showErrors ? errors : null;

	// Keep the route's current driver selectable even if the driver list didn't load.
	const driverOptions = drivers.map((d) => ({ value: String(d.id), label: driverLabel(d) }));
	if (form.preferred_driver_id && !driverOptions.some((o) => o.value === form.preferred_driver_id)) {
		driverOptions.unshift({
			value: form.preferred_driver_id,
			label: route?.preferred_driver ? driverLabel(route.preferred_driver) : `Driver #${form.preferred_driver_id}`,
		});
	}

	const updateBracket = (key: number, field: keyof Omit<BracketDraft, "key">, value: string) =>
		setForm((prev) => ({ ...prev, brackets: prev.brackets.map((b) => (b.key === key ? { ...b, [field]: value } : b)) }));

	const addBracket = () => {
		const fresh = newBracket();
		setForm((prev) => {
			const last = prev.brackets[prev.brackets.length - 1];
			// Start where the previous bracket stops.
			return { ...prev, brackets: [...prev.brackets, { ...fresh, min: last?.max.trim() ? last.max : prev.brackets.length ? "" : "0" }] };
		});
	};

	const removeBracket = (key: number) => setForm((prev) => ({ ...prev, brackets: prev.brackets.filter((b) => b.key !== key) }));

	const submit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (saving) return;
		if (errors.count > 0) {
			setShowErrors(true);
			requestAnimationFrame(() => {
				document.querySelector<HTMLElement>("[data-route-form] [data-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
			});
			return;
		}
		onSave(buildPayload(form));
	};

	return (
		<Sheet
			title={route ? "Edit route" : "New route"}
			description={route ? routeTitle(route) : "Where the Obana fleet goes, how fast, and what it costs."}
			onClose={onCancel}
			onSubmit={submit}
			footer={
				<>
					<Button type="button" variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">
						Cancel
					</Button>
					<Button type="submit" loading={saving} className="flex-1 sm:min-w-40 sm:flex-none">
						{saving ? "Saving…" : route ? "Save changes" : "Create route"}
					</Button>
				</>
			}
		>
			<div className="space-y-6" data-route-form>
				{serverError && <Alert type="error">{serverError}</Alert>}
				{shown && shown.count > 0 && (
					<Alert type="error">
						Fix {shown.count === 1 ? "the highlighted field" : `the ${shown.count} highlighted fields`} before saving.
					</Alert>
				)}

				<div className="space-y-6">
				<Section title="Route" description="The city the fleet collects from and the city it delivers to.">
					<div data-invalid={shown?.origin ? "true" : undefined}>
						<LocationInput
							label="Origin"
							required
							value={form.origin}
							onChange={(location) => setForm((prev) => ({ ...prev, origin: location }))}
							placeholder="Origin city"
						/>
						{shown?.origin && <p className="mt-1.5 text-sm text-rose-600">{shown.origin}</p>}
					</div>
					<div data-invalid={shown?.destination ? "true" : undefined}>
						<LocationInput
							label="Destination"
							required
							value={form.destination}
							onChange={(location) => setForm((prev) => ({ ...prev, destination: location }))}
							placeholder="Destination city"
						/>
						{shown?.destination && <p className="mt-1.5 text-sm text-rose-600">{shown.destination}</p>}
					</div>
				</Section>

				<Section title="Service">
					<div className="grid gap-4 sm:grid-cols-2">
						<div data-invalid={shown?.transport_mode ? "true" : undefined}>
							<Select
								label="Transport mode"
								required
								placeholder="Choose a mode"
								value={form.transport_mode}
								onChange={(e) => {
									const value = e.target.value;
									setForm((prev) => ({ ...prev, transport_mode: value }));
								}}
								options={TRANSPORT_MODES}
								error={shown?.transport_mode}
							/>
						</div>
						<div data-invalid={shown?.service_level ? "true" : undefined}>
							<Select
								label="Service level"
								required
								placeholder="Choose a service level"
								value={form.service_level}
								onChange={(e) => {
									const value = e.target.value;
									setForm((prev) => ({ ...prev, service_level: value }));
								}}
								options={SERVICE_LEVELS}
								error={shown?.service_level}
							/>
						</div>
					</div>
				</Section>

				<Section title="Preferred driver" description="Optional. Shipments on this route are assigned to this driver automatically.">
					<Select
						label="Preferred driver"
						placeholder="No preferred driver"
						value={form.preferred_driver_id}
						onChange={(e) => {
							const value = e.target.value;
							setForm((prev) => ({ ...prev, preferred_driver_id: value }));
						}}
						options={driverOptions}
						helperText={driversError ? "We couldn't load the driver list. You can still save — the current choice is kept." : undefined}
					/>
				</Section>

				<Section title="Weight brackets" description="Price and delivery time for each weight range. Brackets can share an edge (0–5 kg, 5–10 kg) but must not overlap.">
					{shown?.brackets && (
						<p data-invalid="true" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
							{shown.brackets}
						</p>
					)}
					<ol className="space-y-3">
						{form.brackets.map((b, i) => {
							const e = shown?.bracket[i] ?? {};
							const invalid = Object.values(e).some(Boolean);
							const unit = calculateUnitPrice(b);
							return (
								<li
									key={b.key}
									role="group"
									aria-label={`Bracket ${i + 1}`}
									data-invalid={invalid ? "true" : undefined}
									className={invalid ? "rounded-2xl border border-rose-300 bg-rose-50/40 p-3 sm:p-4" : "rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"}
								>
									<div className="mb-3 flex items-center justify-between gap-3">
										<p className="text-sm font-semibold text-slate-900">Bracket {i + 1}</p>
										<div className="flex items-center gap-1">
											<span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200" aria-label="Price per kg">
												{formatPerKg(unit)}
											</span>
											<button
												type="button"
												onClick={() => removeBracket(b.key)}
												aria-label={`Remove bracket ${i + 1}`}
												className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
											>
												<Trash2 className="h-4 w-4" aria-hidden />
											</button>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
										<Input label="Min (kg)" required type="number" inputMode="decimal" step="any" min="0" placeholder="0" value={b.min} error={e.min} onChange={(ev) => updateBracket(b.key, "min", ev.target.value)} />
										<Input label="Max (kg)" required type="number" inputMode="decimal" step="any" min="0" placeholder="10" value={b.max} error={e.max} onChange={(ev) => updateBracket(b.key, "max", ev.target.value)} />
										<Input label="Price (₦)" required type="number" inputMode="decimal" step="any" min="0" placeholder="5000" value={b.price} error={e.price} onChange={(ev) => updateBracket(b.key, "price", ev.target.value)} />
										<Input
											label="ETA"
											required
											placeholder="2-3"
											value={b.eta}
											error={e.eta}
											onChange={(ev) => updateBracket(b.key, "eta", ev.target.value)}
											trailing={<span className="pr-2.5 text-sm text-slate-500">days</span>}
										/>
									</div>
									{e.overlap && <p className="mt-2 text-sm font-medium text-rose-700">{e.overlap}</p>}
								</li>
							);
						})}
					</ol>
					<Button type="button" variant="secondary" onClick={addBracket} className="w-full sm:w-auto">
						<Plus className="h-4 w-4" aria-hidden /> Add bracket
					</Button>
				</Section>
				</div>
			</div>
		</Sheet>
	);
}
