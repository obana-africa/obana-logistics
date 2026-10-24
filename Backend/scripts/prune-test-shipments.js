/**
 * Find test shipments, show them, and — only when told twice — delete them.
 *
 * Deleting goes through DELETE /shipments/:reference, the endpoint the admin
 * dashboard already uses: it removes items and tracking events in one
 * transaction and unlinks quotes and webhook deliveries rather than destroying
 * them. Raw SQL would have to repeat all of that correctly, and a foreign key
 * missed in a hurry is how half a shipment gets left behind.
 *
 * It prints and stops unless both --delete and --yes-delete-them are given.
 *
 *   API=https://obana-logistics-t6qg.onrender.com \
 *   TOKEN=<admin jwt> \
 *   node prune-test-shipments.js --keep-phone 2347035599433
 *
 * Rules, each reported per shipment so nothing is deleted for a reason you
 * cannot see:
 *   --keep-phone <n>    keep shipments delivering to this number, test the rest
 *   --delete-phone <n>  the opposite: only these are test
 *   --direct-only       also treat ORDER-<timestamp> (no sales order) as test
 *   --before <date>     only consider shipments created before this date
 */

const API = (process.env.API || "").replace(/\/+$/, "");
const TOKEN = process.env.TOKEN || "";

const arg = (name, fallback = null) => {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? fallback : process.argv[i + 1] ?? true;
};
const flag = (name) => process.argv.includes(`--${name}`);

/**
 * Which Zoho a shipment came from, from the id it carries.
 *
 * Every Zoho record id is prefixed with its organization — production ids all
 * begin 6536807 (salesorder_id, customer_id, currency_id, location_id alike)
 * and staging ids begin 6519617. Nothing in the shipment record names the org,
 * but the sales order id it stores gives it away, so a shipment created while
 * the service pointed at staging can be told apart from a real one years
 * later.
 */
const ZOHO_PREFIX = { production: "6536807", staging: "6519617" };

const keepPhone = arg("keep-phone");
const deletePhone = arg("delete-phone");
const directOnly = flag("direct-only");
/* Shipments carrying a Zoho id from any other org are test by definition. */
const realZoho = String(arg("real-zoho", ZOHO_PREFIX.production));
const zohoRule = flag("zoho-org");
/* A throwaway mail domain on either end — opmail.com and the like — is nobody
   real. Matched against the whole shipment record rather than one field,
   because the address it was typed into varies: pickup contact, delivery
   contact, the store customer, the original payload. */
const testEmail = String(arg("test-email", "") || "").toLowerCase();
const needsDetail = zohoRule || Boolean(testEmail);
const before = arg("before") ? new Date(arg("before")) : null;
const reallyDelete = flag("delete") && flag("yes-delete-them");

if (!API || !TOKEN) {
	console.error("Set API and TOKEN. TOKEN is an admin JWT — the one the dashboard uses.");
	process.exit(1);
}
if (!keepPhone && !deletePhone) {
	console.error("Give --keep-phone <number> or --delete-phone <number>. Refusing to guess which way round it is.");
	process.exit(1);
}

/** Compare numbers however they were typed: +234…, 234…, 0803…. */
const sameNumber = (a, b) => {
	const bare = (v) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
	const x = bare(a);
	const y = bare(b);
	if (!x || !y) return false;
	return x === y || x.endsWith(y) || y.endsWith(x);
};

const get = async (path) => {
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
	if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
	return res.json();
};

/** Why this one is being treated as a test, in words. Null means keep it. */
const zohoIdOf = (s) =>
	String(s.metadata?.zoho?.salesorder_id ?? s.metadata?.books_invoice?.estimate_id ?? s.metadata?.books_invoice?.invoice_id ?? "");

const testReason = (s) => {
	const phone = s.delivery_address?.phone;
	if (before && new Date(s.createdAt) >= before) return null;

	/* A Zoho id from another organisation — staging, usually — is the clearest
	   evidence there is, so it is checked first and reported as itself. */
	if (testEmail && String(s.__raw ?? "").toLowerCase().includes(testEmail)) {
		return `test email domain ${testEmail}`;
	}

	if (zohoRule) {
		const id = zohoIdOf(s);
		if (id && !id.startsWith(realZoho)) {
			const which = id.startsWith(ZOHO_PREFIX.staging) ? "staging Zoho" : `Zoho org ${id.slice(0, 7)}`;
			return `came from ${which} (${id})`;
		}
	}

	if (deletePhone) return sameNumber(phone, deletePhone) ? `delivery phone ${phone}` : null;

	/* --keep-phone: everything that is not the real customer's number. */
	if (sameNumber(phone, keepPhone)) return null;
	if (directOnly && !/^(SO|QT|EST|INV)[-\s]/i.test(String(s.order_reference ?? ""))) {
		return `booked directly (${s.order_reference}) and not delivering to the kept number`;
	}
	if (directOnly) return null;
	return `delivery phone ${phone || "none"} is not the kept number`;
};

(async () => {
	const all = [];
	for (let page = 1; ; page++) {
		const body = await get(`/shipments?page=${page}&limit=100`);
		const rows = body?.data?.shipments ?? body?.data ?? [];
		if (!Array.isArray(rows) || rows.length === 0) break;
		all.push(...rows);
		if (rows.length < 100) break;
	}
	console.log(`${all.length} shipments on the server\n`);

	if (needsDetail) {
		/* The list carries neither metadata nor the contact emails, so each
		   shipment is read in full. Slow and deliberate: this decides what
		   gets deleted. */
		process.stdout.write("reading each shipment");
		for (const s of all) {
			try {
				const detail = await get(`/shipments/${encodeURIComponent(s.shipment_reference)}`);
				const body = (detail?.data ?? detail) ?? {};
				s.metadata = body.metadata ?? null;
				s.__raw = JSON.stringify(body);
			} catch {
				s.metadata = null;
				s.__raw = "";
			}
			process.stdout.write(".");
		}
		console.log("\n");
		const unread = all.filter((s) => !s.__raw).length;
		if (unread) console.log(`${unread} shipments could not be read in full — the Zoho and email rules cannot judge those.\n`);
	}

	const doomed = [];
	for (const s of all) {
		const reason = testReason(s);
		const line = `${String(s.shipment_reference).padEnd(26)} ${String(s.status).padEnd(11)} ${String(s.delivery_address?.phone ?? "—").padEnd(16)} ${String(s.order_reference ?? "").padEnd(24)}`;
		if (reason) {
			doomed.push(s);
			console.log(`  DELETE  ${line} ${reason}`);
		} else {
			console.log(`  keep    ${line}`);
		}
	}

	console.log(`\n${doomed.length} to delete, ${all.length - doomed.length} to keep`);

	if (!reallyDelete) {
		console.log("\nNothing was deleted. Add --delete --yes-delete-them to do it for real.");
		return;
	}

	console.log("\nDeleting…");
	let gone = 0;
	for (const s of doomed) {
		const res = await fetch(`${API}/shipments/${encodeURIComponent(s.shipment_reference)}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${TOKEN}` },
		});
		const ok = res.ok;
		if (ok) gone += 1;
		console.log(`  ${ok ? "deleted" : `FAILED ${res.status}`}  ${s.shipment_reference}`);
	}
	console.log(`\n${gone} of ${doomed.length} deleted.`);
})().catch((e) => {
	console.error("Stopped:", e.message);
	process.exit(1);
});
