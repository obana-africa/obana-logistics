

"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, ChevronDown, Search, X } from "lucide-react";

interface LocationInputProps {
	label: string;
	value: {
		city: string;
		state: string;
		country: string;
		countryCode?: string;
		stateCode?: string;
	};
	onChange: (location: {
		city: string;
		state: string;
		country: string;
		countryCode: string;
		stateCode: string;
	}) => void;
	required?: boolean;
	placeholder?: string;
}

export const LocationInput: React.FC<LocationInputProps> = ({
	label,
	value,
	onChange,
	required = false,
	placeholder = "Start typing city name...",
}) => {
	const [countries, setCountries] = useState<any[]>([]);
	const TERMINAL_AFRICA_BASE_URL = process.env.NEXT_PUBLIC_TERMINAL_AFRICA_BASE_URL;
	const TERMINAL_AFRICA_SECRET_KEY = process.env.NEXT_PUBLIC_TERMINAL_AFRICA_SECRET_KEY;
	const apiHeaders = {
		'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`,
		'Content-Type': 'application/json'
	};

	const [states, setStates] = useState<any[]>([]);
	const [cities, setCities] = useState<any[]>([]);
	
	// Queries for filtering
	const [countryQuery, setCountryQuery] = useState("");
	const [stateQuery, setStateQuery] = useState("");
	const [cityQuery, setCityQuery] = useState("");
	
	// Dropdown visibility
	const [showCityDropdown, setShowCityDropdown] = useState(false);
	const [showStateDropdown, setShowStateDropdown] = useState(false);
	const [showCountryDropdown, setShowCountryDropdown] = useState(false);
	
	const [loadingStates, setLoadingStates] = useState(false);
	const [loadingCities, setLoadingCities] = useState(false);

	// Refs
	const cityInputRef = useRef<HTMLInputElement>(null);
	const stateInputRef = useRef<HTMLInputElement>(null);
	const countryInputRef = useRef<HTMLInputElement>(null);
	const cityDropdownRef = useRef<HTMLDivElement>(null);
	const stateDropdownRef = useRef<HTMLDivElement>(null);
	const countryDropdownRef = useRef<HTMLDivElement>(null);

	// Load countries on mount
	useEffect(() => {
		const fetchCountries = async () => {
			try {
				const response = await fetch(`${TERMINAL_AFRICA_BASE_URL}/countries`, { headers: apiHeaders });
				const data = await response.json();
				if (data.status && Array.isArray(data.data)) {
					setCountries(data.data);
				}
			} catch (error) {
				console.error("Failed to load countries", error);
			}
		};
		fetchCountries();
	}, []);

	// Load states when country changes
	useEffect(() => {
		if (value.countryCode) {
			setLoadingStates(true);
			const fetchStates = async () => {
				try {
					const response = await fetch(`${TERMINAL_AFRICA_BASE_URL}/states?country_code=${value.countryCode}`, { headers: apiHeaders });
					const data = await response.json();
					if (data.status && Array.isArray(data.data)) {
						setStates(data.data);
					} else {
						setStates([]);
					}
				} catch (error) {
					console.error("Failed to load states", error);
					setStates([]);
				} finally {
					setLoadingStates(false);
				}
			};
			fetchStates();
		} else {
			setStates([]);
		}
	}, [value.countryCode]);

	// Load cities when state changes
	useEffect(() => {
		if (value.countryCode && value.stateCode) {
			setLoadingCities(true);
			const fetchCities = async () => {
				try {
					const response = await fetch(`${TERMINAL_AFRICA_BASE_URL}/cities?country_code=${value.countryCode}&state_code=${value.stateCode}`, { headers: apiHeaders });
					const data = await response.json();
					if (data.status && Array.isArray(data.data)) {
						setCities(data.data);
					} else {
						setCities([]);
					}
				} catch (error) {
					console.error("Failed to load cities", error);
					setCities([]);
				} finally {
					setLoadingCities(false);
				}
			};
			fetchCities();
		} else {
			setCities([]);
		}
	}, [value.countryCode, value.stateCode]);

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				cityDropdownRef.current &&
				!cityDropdownRef.current.contains(event.target as Node) &&
				cityInputRef.current &&
				!cityInputRef.current.contains(event.target as Node)
			) {
				setShowCityDropdown(false);
			}
			if (
				stateDropdownRef.current &&
				!stateDropdownRef.current.contains(event.target as Node) &&
				stateInputRef.current &&
				!stateInputRef.current.contains(event.target as Node)
			) {
				setShowStateDropdown(false);
			}
			if (
				countryDropdownRef.current &&
				!countryDropdownRef.current.contains(event.target as Node) &&
				countryInputRef.current &&
				!countryInputRef.current.contains(event.target as Node)
			) {
				setShowCountryDropdown(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleCountrySelect = (country: any) => {
		onChange({
			city: "",
			state: "",
			country: country.name,
			countryCode: country.isoCode,
			stateCode: "",
		});
		setCountryQuery("");
		setStateQuery("");
		setCityQuery("");
		setShowCountryDropdown(false);
	};

	const handleStateSelect = (state: any) => {
		onChange({
			...value,
			state: state.name,
			stateCode: state.isoCode,
			city: "",
			countryCode: value.countryCode || "", // Ensure string
		});
		setStateQuery("");
		setCityQuery("");
		setShowStateDropdown(false);
	};

	const handleCitySelect = (city: any) => {
		onChange({
			...value,
			city: city.name,
			countryCode: value.countryCode || "",
			stateCode: value.stateCode || "",
		});
		setCityQuery(city.name);
		setShowCityDropdown(false);
	};

	const clearLocation = () => {
		onChange({
			city: "",
			state: "",
			country: "",
			countryCode: "",
			stateCode: "",
		});
		setCountryQuery("");
		setStateQuery("");
		setCityQuery("");
	};

	const filteredCountries = countries.filter((c) =>
		c.name.toLowerCase().includes((countryQuery || value.country).toLowerCase())
	);

	const filteredStates = states.filter((s) =>
		s.name.toLowerCase().includes((stateQuery || value.state).toLowerCase())
	);

	const filteredCities = cities.filter((c) =>
		c.name.toLowerCase().includes((cityQuery || value.city).toLowerCase())
	);

	return (
		<div className="space-y-3">
			<label className="block text-sm font-medium text-gray-700">
				{label} {required && <span className="text-red-500">*</span>}
			</label>

			{/* Country Selection */}
			<div className="relative">
				<div className="relative">
					<input
						ref={countryInputRef}
						type="text"
						value={countryQuery || value.country}
						onChange={(e) => {
							setCountryQuery(e.target.value);
							setShowCountryDropdown(true);
							if (!e.target.value) {
								onChange({ ...value, country: '', countryCode: '', state: '', stateCode: '', city: '' });
							}
						}}
						onFocus={() => setShowCountryDropdown(true)}
						placeholder="Select Country..."
						className="w-full px-4 py-2.5 pr-10 border border-gray-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						required={required}
					/>
					<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
				</div>

				{showCountryDropdown && filteredCountries.length > 0 && (
					<div
						ref={countryDropdownRef}
						className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto cursor-pointer"
					>
						{filteredCountries.slice(0, 10).map((country) => (
							<div
								key={country.isoCode}
								onClick={() => handleCountrySelect(country)}
								className="px-4 py-2.5 text-left hover:bg-blue-50 flex items-center text-slate-800 gap-2 transition-colors"
							>
								<MapPin className="h-4 w-4 text-gray-400" />
								<span className="font-medium">{country.name}</span>
								<span className="text-sm text-gray-500">
									({country.isoCode})
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* State Selection (only if country selected) */}
			{value.countryCode && (
				<div className="relative">
					<div className="relative">
						<input
							ref={stateInputRef}
							type="text"
							value={stateQuery || value.state}
							onChange={(e) => {
								setStateQuery(e.target.value);
								setShowStateDropdown(true);
							if (!e.target.value) onChange({ ...value, state: '', stateCode: '', city: '', countryCode: value.countryCode || '' });
							}}
							onFocus={() => setShowStateDropdown(true)}
							placeholder={loadingStates ? "Loading states..." : (states.length > 0 ? "Select State/Province..." : "No states available")}
							className="w-full px-4 py-2.5 pr-10 border border-gray-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							required={required}
							disabled={loadingStates || states.length === 0}
						/>
						<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
					</div>

					{showStateDropdown && filteredStates.length > 0 && (
						<div
							ref={stateDropdownRef}
							className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto cursor-pointer"
						>
							{filteredStates.map((state) => (
								<div
									key={state.isoCode}
									onClick={() => handleStateSelect(state)}
									className="px-4 py-2.5 text-left hover:bg-blue-50 text-slate-800 transition-colors"
								>
									{state.name}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* City Selection (only if state selected) */}
			{value.stateCode && (
				<div className="relative">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
						<input
							ref={cityInputRef}
							type="text"
							value={cityQuery || value.city}
							onChange={(e) => {
								setCityQuery(e.target.value);
								setShowCityDropdown(true);
							if (!e.target.value) onChange({ ...value, city: '', countryCode: value.countryCode || '', stateCode: value.stateCode || '' });
							}}
							onFocus={() => setShowCityDropdown(true)}
							placeholder={loadingCities ? "Loading cities..." : (cities.length > 0 ? "Select City..." : "Type city name...")}
							className="w-full pl-10 pr-10 py-2.5 border text-slate-800 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							required={required}
							disabled={loadingCities}
						/>
						{(value.city || cityQuery) && (
							<button
								type="button"
								onClick={clearLocation}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
							>
								<X className="h-5 w-5" />
							</button>
						)}
					</div>

					{showCityDropdown && filteredCities.length > 0 && (
						<div
							ref={cityDropdownRef}
							className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto cursor-pointer"
						>
							{filteredCities.map((city, index) => (
								<div
									key={`${city.name}-${index}`}
									onClick={() => handleCitySelect(city)}
									className="px-4 py-2.5 text-left hover:bg-blue-50 text-slate-800 transition-colors"
								>
									<div className="font-medium text-gray-900">
										{city.name}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Selected Location Display */}
			{value.city && value.state && (
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
					<div className="flex items-start gap-2">
						<MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="text-sm font-medium text-blue-900">
								{value.city}
							</div>
							<div className="text-xs text-blue-700">
								{value.state}, {value.country}
							</div>
						</div>
						<button
							type="button"
							onClick={clearLocation}
							className="text-blue-600 hover:text-blue-800"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
