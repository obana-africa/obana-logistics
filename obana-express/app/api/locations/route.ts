import { NextRequest, NextResponse } from "next/server";
import { City, Country, State } from "country-state-city";

// Our own country / state / city lookups, served from the bundled country-state-city dataset.
// No third-party call — so it never fails when Terminal Africa is down, and no partner key reaches the browser.
//   /api/locations?type=countries
//   /api/locations?type=states&country=NG
//   /api/locations?type=cities&country=NG&state=LA

// African markets first, then everyone else alphabetically.
const PRIORITY = ["NG", "GH", "KE", "ZA", "EG", "CI", "SN", "CM", "RW", "UG", "TZ", "ET", "MA", "BJ", "TG"];

const CACHE = { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" };

export function GET(req: NextRequest) {
	const params = req.nextUrl.searchParams;
	const type = params.get("type");
	const country = (params.get("country") ?? "").toUpperCase();
	const state = params.get("state") ?? "";

	if (type === "countries") {
		const all = Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode, flag: c.flag }));
		const rank = (code: string) => (PRIORITY.includes(code) ? PRIORITY.indexOf(code) : PRIORITY.length);
		all.sort((a, b) => rank(a.isoCode) - rank(b.isoCode) || a.name.localeCompare(b.name));
		return NextResponse.json({ status: true, data: all }, { headers: CACHE });
	}
	if (type === "states" && country) {
		const data = State.getStatesOfCountry(country).map((s) => ({ name: s.name, isoCode: s.isoCode }));
		return NextResponse.json({ status: true, data }, { headers: CACHE });
	}
	if (type === "cities" && country && state) {
		const data = City.getCitiesOfState(country, state).map((c) => ({ name: c.name }));
		return NextResponse.json({ status: true, data }, { headers: CACHE });
	}
	return NextResponse.json(
		{ status: false, message: "Use ?type=countries, ?type=states&country=NG or ?type=cities&country=NG&state=LA" },
		{ status: 400 }
	);
}
