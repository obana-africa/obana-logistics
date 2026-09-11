"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";

type Place = { name: string; isoCode: string; flag?: string };
type Location = { city: string; state: string; country: string; countryCode: string; stateCode: string };

interface LocationInputProps {
	label: string;
	value: { city: string; state: string; country: string; countryCode?: string; stateCode?: string };
	onChange: (location: Location) => void;
	required?: boolean;
	placeholder?: string;
	/** Preselected when nothing is chosen yet — most shipments start in Nigeria. */
	defaultCountryCode?: string;
}

// One request per list for the whole session, shared by every picker on the page.
const cache = new Map<string, Promise<unknown[]>>();
function load<T>(query: string): Promise<T[]> {
	if (!cache.has(query)) {
		const request = fetch(`/api/locations?${query}`)
			.then((r) => r.json())
			.then((body) => (body?.status && Array.isArray(body.data) ? body.data : []))
			.catch(() => {
				cache.delete(query); // let the next attempt retry
				return [];
			});
		cache.set(query, request);
	}
	return cache.get(query) as Promise<T[]>;
}

const field =
	"h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-gray-400 focus:border-[#1B3E5D] focus:ring-4 focus:ring-[#1B3E5D]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

/**
 * Country → state → city picker. Uses the phone's own dropdowns for country and state,
 * and a searchable city field that also accepts towns not in the list.
 */
export const LocationInput = ({
	label,
	value,
	onChange,
	required = false,
	placeholder = "Type or pick a city",
	defaultCountryCode = "NG",
}: LocationInputProps) => {
	const id = useId();
	const current: Location = {
		city: value.city || "",
		state: value.state || "",
		country: value.country || "",
		countryCode: value.countryCode || "",
		stateCode: value.stateCode || "",
	};

	const [countries, setCountries] = useState<Place[]>([]);
	// Lists remember which parent they belong to, so "loading" is derived rather than stored.
	const [states, setStates] = useState<{ key: string; list: Place[] }>({ key: "", list: [] });
	const [cities, setCities] = useState<{ key: string; list: { name: string }[] }>({ key: "", list: [] });
	const [cityQuery, setCityQuery] = useState("");
	const [cityOpen, setCityOpen] = useState(false);

	const stateKey = current.countryCode;
	const cityKey = current.countryCode && current.stateCode ? `${current.countryCode}:${current.stateCode}` : "";
	const statesLoading = Boolean(stateKey) && states.key !== stateKey;
	const citiesLoading = Boolean(cityKey) && cities.key !== cityKey;
	const stateList = useMemo(() => (states.key === stateKey ? states.list : []), [states, stateKey]);
	const cityList = useMemo(() => (cities.key === cityKey ? cities.list : []), [cities, cityKey]);

	useEffect(() => {
		let active = true;
		load<Place>("type=countries").then((list) => active && setCountries(list));
		return () => {
			active = false;
		};
	}, []);

	// Preselect the default country once the list is in (only when nothing is chosen yet).
	useEffect(() => {
		if (current.countryCode || countries.length === 0) return;
		const preset = countries.find((c) => c.isoCode === defaultCountryCode);
		if (preset) onChange({ city: "", state: "", stateCode: "", country: preset.name, countryCode: preset.isoCode });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [countries]);

	useEffect(() => {
		if (!stateKey) return;
		let active = true;
		load<Place>(`type=states&country=${stateKey}`).then((list) => active && setStates({ key: stateKey, list }));
		return () => {
			active = false;
		};
	}, [stateKey]);

	useEffect(() => {
		if (!cityKey) return;
		let active = true;
		const [country, state] = cityKey.split(":");
		load<{ name: string }>(`type=cities&country=${country}&state=${encodeURIComponent(state)}`).then((list) => active && setCities({ key: cityKey, list }));
		return () => {
			active = false;
		};
	}, [cityKey]);

	const suggestions = useMemo(() => {
		const q = cityQuery.trim().toLowerCase();
		if (!q) return cityList.slice(0, 60);
		const starts = cityList.filter((c) => c.name.toLowerCase().startsWith(q));
		const contains = cityList.filter((c) => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q));
		return [...starts, ...contains].slice(0, 60);
	}, [cityList, cityQuery]);

	const pickCity = (name: string) => {
		onChange({ ...current, city: name });
		setCityQuery(name);
		setCityOpen(false);
	};

	const stateHasNoList = Boolean(stateKey) && !statesLoading && stateList.length === 0;

	return (
		<fieldset className="space-y-2">
			<legend className="mb-1.5 block text-sm font-medium text-gray-700">
				{label} {required && <span className="text-red-500">*</span>}
			</legend>

			<div className="grid gap-3 sm:grid-cols-3">
				{/* Country */}
				<div className="relative">
					<label htmlFor={`${id}-country`} className="sr-only">
						Country
					</label>
					<select
						id={`${id}-country`}
						value={current.countryCode}
						required={required}
						onChange={(e) => {
							const c = countries.find((x) => x.isoCode === e.target.value);
							if (c) onChange({ city: "", state: "", stateCode: "", country: c.name, countryCode: c.isoCode });
						}}
						className={`${field} appearance-none pr-10`}
					>
						<option value="" disabled>
							{countries.length ? "Country" : "Loading countries…"}
						</option>
						{countries.map((c) => (
							<option key={c.isoCode} value={c.isoCode}>
								{c.flag ? `${c.flag} ` : ""}
								{c.name}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
				</div>

				{/* State — a list when we have one, free text otherwise */}
				<div className="relative">
					<label htmlFor={`${id}-state`} className="sr-only">
						State or region
					</label>
					{stateHasNoList ? (
						<input
							id={`${id}-state`}
							value={current.state}
							onChange={(e) => onChange({ ...current, state: e.target.value, stateCode: "", city: "" })}
							placeholder="State or region"
							required={required}
							className={field}
						/>
					) : (
						<>
							<select
								id={`${id}-state`}
								value={current.stateCode}
								required={required}
								disabled={!current.countryCode || statesLoading}
								onChange={(e) => {
									const s = stateList.find((x) => x.isoCode === e.target.value);
									if (s) {
										onChange({ ...current, state: s.name, stateCode: s.isoCode, city: "" });
										setCityQuery("");
									}
								}}
								className={`${field} appearance-none pr-10`}
							>
								<option value="" disabled>
									{statesLoading ? "Loading states…" : "State"}
								</option>
								{stateList.map((s) => (
									<option key={s.isoCode} value={s.isoCode}>
										{s.name}
									</option>
								))}
							</select>
							{statesLoading ? (
								<Loader2 className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />
							) : (
								<ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
							)}
						</>
					)}
				</div>

				{/* City — search the list or type any town */}
				<div className="relative">
					<label htmlFor={`${id}-city`} className="sr-only">
						City or town
					</label>
					<input
						id={`${id}-city`}
						role="combobox"
						aria-expanded={cityOpen && suggestions.length > 0}
						aria-controls={`${id}-cities`}
						aria-autocomplete="list"
						autoComplete="off"
						value={cityOpen ? cityQuery : current.city}
						disabled={!current.state}
						required={required}
						placeholder={citiesLoading ? "Loading cities…" : placeholder}
						onFocus={() => {
							setCityQuery(current.city);
							setCityOpen(true);
						}}
						onChange={(e) => {
							setCityQuery(e.target.value);
							setCityOpen(true);
						}}
						onBlur={() => {
							// Keep whatever was typed — small towns may not be in the list.
							const typed = cityQuery.trim();
							if (typed && typed !== current.city) onChange({ ...current, city: typed });
							setCityOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && cityOpen && suggestions[0]) {
								e.preventDefault();
								pickCity(suggestions[0].name);
							}
							if (e.key === "Escape") setCityOpen(false);
						}}
						className={`${field} pr-10`}
					/>
					{citiesLoading ? (
						<Loader2 className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />
					) : (
						<MapPin className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
					)}

					{cityOpen && suggestions.length > 0 && (
						<ul id={`${id}-cities`} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
							{suggestions.map((c, i) => (
								<li
									key={`${c.name}-${i}`}
									role="option"
									aria-selected={c.name === current.city}
									// mousedown fires before the input's blur, so the tap isn't lost
									onMouseDown={(e) => {
										e.preventDefault();
										pickCity(c.name);
									}}
									className="cursor-pointer px-4 py-3 text-[15px] text-slate-800 hover:bg-blue-50"
								>
									{c.name}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{current.state && !citiesLoading && cityList.length === 0 && (
				<p className="text-xs text-gray-500">Type the town or area name — any place is fine.</p>
			)}
		</fieldset>
	);
};
