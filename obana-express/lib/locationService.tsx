/* eslint-disable @typescript-eslint/no-explicit-any */
const GEONAMES_USERNAME = "simple001";
const GEONAMES_BASE_URL = "https://secure.geonames.org";

export interface Country {
	geonameId: number;
	countryCode: string;
	countryName: string;
}

export interface City {
	geonameId: number;
	name: string;
	adminName1: string; 
	countryName: string;
	countryCode: string;
	lat: string;
	lng: string;
}

class LocationService {
	private countriesCache: Country[] = [];

	async getCountries(): Promise<Country[]> {
		if (this.countriesCache.length > 0) {
			return this.countriesCache;
		}

		try {
			const response = await fetch(
				`${GEONAMES_BASE_URL}/countryInfoJSON?username=${GEONAMES_USERNAME}`
			);
			const data = await response.json();

			this.countriesCache = data.geonames.map((country: any) => ({
				geonameId: country.geonameId,
				countryCode: country.countryCode,
				countryName: country.countryName,
			}));

			return this.countriesCache;
		} catch (error) {
			console.error("Error fetching countries:", error);
			return [];
		}
	}

	async searchCities(query: string, countryCode?: string): Promise<City[]> {
		if (!query || query.length < 2) {
			return [];
		}

		try {
			let url = `${GEONAMES_BASE_URL}/searchJSON?name_startsWith=${encodeURIComponent(query)}&featureClass=P&maxRows=10&username=${GEONAMES_USERNAME}`;

			if (countryCode) {
				url += `&country=${countryCode}`;
			}

			const response = await fetch(url);
			const data = await response.json();

			return data.geonames.map((city: any) => ({
				geonameId: city.geonameId,
				name: city.name,
				adminName1: city.adminName1,
				countryName: city.countryName,
				countryCode: city.countryCode,
				lat: city.lat,
				lng: city.lng,
			}));
		} catch (error) {
			console.error("Error searching cities:", error);
			return [];
		}
	}

	async getCitiesByCountry(
		countryCode: string,
		maxRows = 1000
	): Promise<City[]> {
		try {
			const response = await fetch(
				`${GEONAMES_BASE_URL}/searchJSON?country=${countryCode}&featureClass=P&maxRows=${maxRows}&username=${GEONAMES_USERNAME}&orderby=population`
			);
			const data = await response.json();

			return data.geonames.map((city: any) => ({
				geonameId: city.geonameId,
				name: city.name,
				adminName1: city.adminName1,
				countryName: city.countryName,
				countryCode: city.countryCode,
				lat: city.lat,
				lng: city.lng,
			}));
		} catch (error) {
			console.error("Error fetching cities:", error);
			return [];
		}
	}
}

export const locationService = new LocationService();
