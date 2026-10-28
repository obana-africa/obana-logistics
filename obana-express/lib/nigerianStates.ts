/**
 * The thirty-six states and the Federal Capital Territory.
 *
 * A fixed list rather than a text box, because the last mile is priced by
 * matching a route between two states, and a state typed by hand does not
 * match one. "Port Harcourt" went into a state field — reasonably, it is
 * where the parcel is going — the search for a route from there found
 * nothing, and the leg was silently never priced.
 *
 * `value` is spelled as the route table spells it, which is what the matching
 * normalises against; `label` is what reads naturally in the list. They differ
 * in one place: the capital is "Abuja" in every seeded route, while people
 * look for FCT.
 */
export const NIGERIAN_STATES: { value: string; label: string }[] = [
	{ value: "Abia", label: "Abia" },
	{ value: "Abuja", label: "Abuja (FCT)" },
	{ value: "Adamawa", label: "Adamawa" },
	{ value: "Akwa Ibom", label: "Akwa Ibom" },
	{ value: "Anambra", label: "Anambra" },
	{ value: "Bauchi", label: "Bauchi" },
	{ value: "Bayelsa", label: "Bayelsa" },
	{ value: "Benue", label: "Benue" },
	{ value: "Borno", label: "Borno" },
	{ value: "Cross River", label: "Cross River" },
	{ value: "Delta", label: "Delta" },
	{ value: "Ebonyi", label: "Ebonyi" },
	{ value: "Edo", label: "Edo" },
	{ value: "Ekiti", label: "Ekiti" },
	{ value: "Enugu", label: "Enugu" },
	{ value: "Gombe", label: "Gombe" },
	{ value: "Imo", label: "Imo" },
	{ value: "Jigawa", label: "Jigawa" },
	{ value: "Kaduna", label: "Kaduna" },
	{ value: "Kano", label: "Kano" },
	{ value: "Katsina", label: "Katsina" },
	{ value: "Kebbi", label: "Kebbi" },
	{ value: "Kogi", label: "Kogi" },
	{ value: "Kwara", label: "Kwara" },
	{ value: "Lagos", label: "Lagos" },
	{ value: "Nasarawa", label: "Nasarawa" },
	{ value: "Niger", label: "Niger" },
	{ value: "Ogun", label: "Ogun" },
	{ value: "Ondo", label: "Ondo" },
	{ value: "Osun", label: "Osun" },
	{ value: "Oyo", label: "Oyo" },
	{ value: "Plateau", label: "Plateau" },
	{ value: "Rivers", label: "Rivers" },
	{ value: "Sokoto", label: "Sokoto" },
	{ value: "Taraba", label: "Taraba" },
	{ value: "Yobe", label: "Yobe" },
	{ value: "Zamfara", label: "Zamfara" },
];
