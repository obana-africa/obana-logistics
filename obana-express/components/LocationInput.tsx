"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, ChevronDown, Search, X } from "lucide-react";
import { locationService, City, Country } from "@/lib/locationService";

interface LocationInputProps {
	label: string;
	value: {
		city: string;
		state: string;
		country: string;
		countryCode?: string;
	};
	onChange: (location: {
		city: string;
		state: string;
		country: string;
		countryCode: string;
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
	const [countries, setCountries] = useState<Country[]>([]);
	const [cityQuery, setCityQuery] = useState("");
	const [cityResults, setCityResults] = useState<City[]>([]);
	const [showCityDropdown, setShowCityDropdown] = useState(false);
	const [showCountryDropdown, setShowCountryDropdown] = useState(false);
	const [isLoadingCities, setIsLoadingCities] = useState(false);
	const cityInputRef = useRef<HTMLInputElement>(null);
	const countryInputRef = useRef<HTMLInputElement>(null);
	const cityDropdownRef = useRef<HTMLDivElement>(null);
	const countryDropdownRef = useRef<HTMLDivElement>(null);

	// Load countries on mount
	useEffect(() => {
		locationService.getCountries().then(setCountries);
	}, []);

	// Search cities when query changes
	useEffect(() => {
		const searchCities = async () => {
			if (cityQuery.length >= 2) {
				setIsLoadingCities(true);
				const results = await locationService.searchCities(
					cityQuery,
					value.countryCode
				);
				setCityResults(results);
				setIsLoadingCities(false);
			} else {
				setCityResults([]);
			}
		};

		const debounce = setTimeout(searchCities, 300);
		return () => clearTimeout(debounce);
	}, [cityQuery, value.countryCode]);

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

	const handleCountrySelect = (country: Country) => {
		onChange({
			city: "",
			state: "",
			country: country.countryName,
			countryCode: country.countryCode,
		});
		setCityQuery("");
		setCityResults([]);
		setShowCountryDropdown(false);
	};

	const handleCitySelect = (city: City) => {
		onChange({
			city: city.name,
			state: city.adminName1,
			country: city.countryName,
			countryCode: city.countryCode,
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
		});
		setCityQuery("");
		setCityResults([]);
	};

	const filteredCountries = countries.filter((c) =>
		c.countryName.toLowerCase().includes(value.country.toLowerCase())
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
						value={value.country}
						onChange={(e) => {
							onChange({
								...value,
								country: e.target.value,
								countryCode: value.countryCode || "",
							});
							setShowCountryDropdown(true);
						}}
						onFocus={() => setShowCountryDropdown(true)}
						placeholder="Select country..."
						className="w-full px-4 py-2.5 pr-10 border border-gray-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						required={required}
					/>
					<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
				</div>

				{showCountryDropdown && filteredCountries.length > 0 && (
					<div
						ref={countryDropdownRef}
						className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
					>
						{filteredCountries.slice(0, 10).map((country) => (
							<button
								key={country.geonameId}
								type="button"
								onClick={() => handleCountrySelect(country)}
								className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center text-slate-800 gap-2 transition-colors"
							>
								<MapPin className="h-4 w-4 text-gray-400" />
								<span className="font-medium">{country.countryName}</span>
								<span className="text-sm text-gray-500">
									({country.countryCode})
								</span>
							</button>
						))}
					</div>
				)}
			</div>

			{/* City Search (only show if country is selected) */}
			{value.countryCode && (
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
							}}
							onFocus={() => setShowCityDropdown(true)}
							placeholder={placeholder}
							className="w-full pl-10 pr-10 py-2.5 border text-slate-800 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							required={required}
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

					{showCityDropdown && (cityResults.length > 0 || isLoadingCities) && (
						<div
							ref={cityDropdownRef}
							className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
						>
							{isLoadingCities ? (
								<div className="px-4 py-3 text-center text-gray-500">
									<div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
									<span className="ml-2">Searching...</span>
								</div>
							) : (
								cityResults.map((city) => (
									<button
										key={city.geonameId}
										type="button"
										onClick={() => handleCitySelect(city)}
										className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
									>
										<div className="flex items-start gap-2">
											<MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
											<div className="flex-1 min-w-0">
												<div className="font-medium text-gray-900">
													{city.name}
												</div>
												<div className="text-sm text-gray-600">
													{city.adminName1 && `${city.adminName1}, `}
													{city.countryName}
												</div>
											</div>
										</div>
									</button>
								))
							)}
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
