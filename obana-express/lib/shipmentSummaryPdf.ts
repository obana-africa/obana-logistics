/**
 * The shipment summary as a PDF the customer can keep.
 *
 * Printed from the browser rather than generated on the server: every browser
 * offers "Save as PDF" from its print dialog, which is a real PDF, and the
 * alternative is a rendering library carried by everyone who loads the booking
 * page to produce a page of text. Opened in its own window so the app's own
 * stylesheet, navigation and buttons stay out of it — what prints is a
 * document, not a screenshot of a dashboard.
 *
 * Nothing here is sent anywhere. The window is built, printed and closed.
 */

/* The footer, as Obana writes it — and each thing it names is a link, so a
   customer holding the document can reach the one they need without typing
   anything. Thaja says what it is in brackets: the name on its own tells a
   first-time reader nothing. */
const FOOTER: { text: string; url?: string }[] = [
	{ text: "www.obana.africa", url: "https://obana.africa" },
	{ text: " \u2014 One Platform Powering your Business. " },
	{ text: "Marketplace", url: "https://shop.obana.africa" },
	{ text: " | " },
	{ text: "Financing", url: "https://obana.africa/obana-pss" },
	{ text: " | " },
	{ text: "Logistics", url: "https://logistics.obana.africa" },
	{ text: " | " },
	{ text: "Thaja (POS/Webshop)", url: "https://taja.obana.africa" },
];

/* Where payment goes. The same two accounts the issued summary carries. */
const ACCOUNTS = [
	{ name: "Icon Tech & Ecommerce Service Limited", bank: "Sterling Bank", number: "0118874437", currency: "NGN" },
	{ name: "Icon Tech & Ecommerce Service Limited", bank: "Carbon MicroFinance Bank", number: "9932489664", currency: "NGN" },
];

export type SummaryLine = { label: string; value: string; strong?: boolean };

export type ShipmentSummary = {
	/** Present once the shipment exists; absent while it is still a quote. */
	reference?: string | null;
	route: string;
	/** Each leg by name, when there is more than one — the route is written as
	    the confirm screen writes it, a line per journey. */
	legs?: { kind?: string; from?: string; to?: string }[] | null;
	service: string;
	/** The window that was sold and the dates it lands on. Omitted when unknown. */
	eta?: string | null;
	weight: string;
	/** How many things are in the consignment. */
	pieces?: string | null;
	/** The rate per kilo, which is what leads the block — the total is the last line of the breakdown. */
	rate?: string | null;
	/** Printed only when there is one. */
	awbNumber?: string | null;
	/** "Converted at EUR 1.00 = NGN 1,655.63", under the charges. */
	conversionNote?: string | null;
	/** Delivery, service charge, total — whatever the screen showed. */
	charges: SummaryLine[];
	pickup: string[];
	delivery: string[];
	items: { name: string; weight: string; value: string }[];
};

/* Everything placed into the document is escaped: a customer's name or an
   address line is text, and text with a < in it must not become markup. */
const esc = (value: string) =>
	String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const row = (line: SummaryLine) => `
  <tr${line.strong ? ' class="total"' : ""}>
    <td>${esc(line.label)}</td>
    <td class="num">${esc(line.value)}</td>
  </tr>`;

const addressBlock = (title: string, lines: string[], tone: "pickup" | "delivery") => `
  <section class="party ${tone}">
    <h3><span class="pin"></span>${esc(title)}</h3>
    ${lines.filter(Boolean).map((l, i) => `<p${i === 0 ? ' class="strong"' : ""}>${esc(l)}</p>`).join("")}
  </section>`;

/* The route as the confirm screen writes it: one line per leg, each named,
   because a single line over a consignment that clears in Ikeja and travels on
   says nothing about the half charged for separately below. */
const routeMarkup = (s: ShipmentSummary) => {
	const legs = s.legs ?? [];
	if (legs.length < 2) return `<strong>${esc(s.route)}</strong>`;
	return legs
		.map(
			(leg) =>
				`<span class="leg"><em>${esc(leg.kind === "local" ? "Last mile" : "Freight")}</em><strong>${esc(
					[leg.from, leg.to].filter(Boolean).join(" → "),
				)}</strong></span>`,
		)
		.join("");
};

const factCell = (label: string, value: string, tone = "") =>
	`<div class="fact"><p class="label">${esc(label)}</p><p class="value ${tone}">${esc(value)}</p></div>`;

/* The confirm screen, as a sheet of paper. Same three cards, same order, same
   colours — somebody downloading this has just read that page, and a document
   laid out differently reads as a document about something else. */
const documentHtml = (s: ShipmentSummary) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(s.reference ? `Obana shipment ${s.reference}` : "Obana shipment summary")}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1b3b5f; padding-bottom: 12px; }
  .brand { font-size: 20px; font-weight: 700; color: #1b3b5f; letter-spacing: -0.01em; }
  .brand span { display: block; font-size: 9px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; }
  .ref { text-align: right; font-size: 10px; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase; }
  .ref strong { display: block; font-size: 15px; letter-spacing: 0; text-transform: none; color: #111827; margin: 2px 0; }
  .ref em { font-style: normal; letter-spacing: 0; text-transform: none; }

  /* The cards, in the screen's own colours. */
  .card { border-radius: 8px; padding: 12px 14px; margin-top: 12px; page-break-inside: avoid; }
  .card h3, .party h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #111827; }
  .shipment { background: linear-gradient(to right, #eff6ff, #faf5ff); border: 1px solid #bfdbfe; }
  .items-card { background: #fcfaff; border: 1px solid #e5e7eb; }
  .mark { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
  .mark.truck { background: #2563eb; }
  .mark.box { background: #9333ea; }

  .grid { display: flex; flex-wrap: wrap; }
  .fact { width: 50%; padding: 0 12px 9px 0; }
  .fact .label { margin: 0; color: #4b5563; font-size: 11px; }
  .fact .value { margin: 1px 0 0; font-weight: 700; }
  .fact .value.rate { color: #16a34a; font-size: 16px; }
  .leg { display: block; }
  .leg em { font-style: normal; color: #6b7280; font-size: 10px; margin-right: 6px; }

  table.charges { width: 100%; border-collapse: collapse; margin-top: 2px; border-top: 1px solid #bfdbfe; }
  table.charges td { padding: 5px 0; color: #4b5563; }
  table.charges .num { text-align: right; font-variant-numeric: tabular-nums; color: #111827; font-weight: 600; }
  table.charges tr.total td { border-top: 1px solid #bfdbfe; font-weight: 700; color: #111827; padding-top: 6px; }
  p.note { margin: 6px 0 0; font-size: 10px; color: #6b7280; }

  .parties { display: flex; gap: 12px; margin-top: 12px; }
  .party { flex: 1; border-radius: 8px; border: 1px solid #e5e7eb; padding: 12px 14px; page-break-inside: avoid; }
  .party.pickup { background: #f5f9ff; }
  .party.delivery { background: #f4fdf7; }
  .party .pin { width: 11px; height: 11px; border-radius: 50%; display: inline-block; flex: none; }
  .party.pickup .pin { background: #2563eb; }
  .party.delivery .pin { background: #16a34a; }
  .party p { margin: 0 0 1px; color: #4b5563; }
  .party p.strong { font-weight: 700; color: #111827; }

  .item { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; border-bottom: 1px solid #e5e7eb; }
  .item:last-child { border-bottom: none; }
  .item .name { font-weight: 700; }
  .item .sub { color: #6b7280; font-size: 10px; margin: 1px 0 0; }
  .item .right { text-align: right; font-variant-numeric: tabular-nums; }
  .item p { margin: 0; }

  /* The two things the screen does not carry, because a document that gets
     paid against needs them. */
  footer { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 10px; page-break-inside: avoid; }
  footer h4 { margin: 0 0 8px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #4b5563; font-weight: 700; }
  footer .accounts { display: flex; gap: 12px; }
  footer .accounts div { flex: 1; }
  footer p { margin: 0 0 1px; color: #4b5563; }
  footer p.strong { font-weight: 700; color: #111827; }
  footer .small { margin-top: 10px; font-size: 10px; color: #6b7280; }
  footer .tagline { display: block; margin-top: 8px; text-align: center; font-size: 10px; color: #6b7280; }
  /* Printed links keep their colour and underline — on paper that is the only
     thing saying they can be tapped. */
  footer .tagline a { color: #1b3b5f; text-decoration: underline; }
</style>
</head>
<body>
  <header>
    <div class="brand">obana<span>Logistics</span></div>
    <div class="ref">
      ${s.reference ? `Shipment summary<strong>${esc(s.reference)}</strong>` : "Shipment summary"}
      <em>${esc(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }))}</em>
    </div>
  </header>

  <section class="card shipment">
    <h3><span class="mark truck"></span>Shipment Summary</h3>
    <div class="grid">
      <div class="fact"><p class="label">Route</p><p class="value">${routeMarkup(s)}</p></div>
      ${factCell("Service", s.service)}
      ${factCell("Estimated arrival", s.eta || "Confirmed after booking")}
      ${factCell("Total weight", s.weight)}
      ${s.rate ? factCell("Shipping rate / kilo", s.rate, "rate") : ""}
      ${s.pieces ? factCell("Number of pieces", s.pieces) : ""}
      ${s.awbNumber ? factCell("Air waybill", s.awbNumber) : ""}
    </div>
    <table class="charges">${s.charges.map(row).join("")}</table>
    ${s.conversionNote ? `<p class="note">${esc(s.conversionNote)}</p>` : ""}
  </section>

  <div class="parties">
    ${addressBlock("Pickup Address", s.pickup, "pickup")}
    ${addressBlock("Delivery Address", s.delivery, "delivery")}
  </div>

  ${
		s.items.length
			? `<section class="card items-card">
    <h3><span class="mark box"></span>Items (${s.items.length})</h3>
    ${s.items
			.map(
				(i) =>
					`<div class="item"><div><p class="name">${esc(i.name)}</p><p class="sub">${esc(i.weight)} each</p></div>
      <div class="right"><p class="name">${esc(i.weight)}</p>${i.value && i.value !== "—" ? `<p class="sub">${esc(i.value)} each</p>` : ""}</div></div>`,
			)
			.join("")}
  </section>`
			: ""
	}

  <footer>
    <h4>Payment</h4>
    <div class="accounts">
      ${ACCOUNTS.map(
			(a) => `<div>
        <p class="strong">${esc(a.name)}</p>
        <p>${esc(a.bank)}</p>
        <p class="strong">${esc(a.number)} (${esc(a.currency)})</p>
      </div>`,
		).join("")}
    </div>
    <p class="small">Customs duties and clearance charges at the destination are not included unless stated above.</p>
    <span class="tagline">${FOOTER.map((part) =>
			part.url ? `<a href="${esc(part.url)}">${esc(part.text)}</a>` : esc(part.text),
		).join("")}</span>
  </footer>
</body>
</html>`;

/**
 * Open the summary in its own window and ask the browser to print it.
 *
 * Returns false when the window could not be opened — a blocker, or a browser
 * that refuses — so the caller can say so rather than leave a button that
 * appears to do nothing.
 */
export function printShipmentSummary(summary: ShipmentSummary): boolean {
	const w = window.open("", "_blank", "width=820,height=1000");
	if (!w) return false;

	w.document.open();
	w.document.write(documentHtml(summary));
	w.document.close();

	/* Printing before the window has laid out gives a blank sheet, and Safari
	   does not fire load for a document written this way — so print on load
	   where it comes, and shortly after regardless. Printing twice is not
	   possible: the second call finds the window already closed. */
	let printed = false;
	const print = () => {
		if (printed || w.closed) return;
		printed = true;
		w.focus();
		w.print();
		/* Left open deliberately: closing it immediately cancels the dialog on
		   some browsers, and the person may want to read it first. */
	};
	w.onload = print;
	setTimeout(print, 400);
	return true;
}
