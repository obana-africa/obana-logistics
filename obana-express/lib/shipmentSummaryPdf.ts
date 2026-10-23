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

export type SummaryLine = { label: string; value: string; strong?: boolean };

export type ShipmentSummary = {
	/** Present once the shipment exists; absent while it is still a quote. */
	reference?: string | null;
	route: string;
	service: string;
	weight: string;
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

const addressBlock = (title: string, lines: string[]) => `
  <div class="party">
    <h3>${esc(title)}</h3>
    ${lines.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("")}
  </div>`;

const documentHtml = (s: ShipmentSummary) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(s.reference ? `Obana shipment ${s.reference}` : "Obana shipment summary")}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1b3b5f; padding-bottom: 12px; }
  .brand { font-size: 18px; font-weight: 700; color: #1b3b5f; letter-spacing: -0.01em; }
  .brand span { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; }
  .ref { text-align: right; font-size: 11px; color: #64748b; }
  .ref strong { display: block; font-size: 13px; color: #1f2937; }
  h2 { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin: 22px 0 8px; }
  .facts { width: 100%; border-collapse: collapse; }
  .facts td { padding: 5px 0; vertical-align: top; }
  .facts td:first-child { color: #64748b; width: 34%; }
  table.charges { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.charges td { padding: 7px 0; border-bottom: 1px solid #e5e7eb; }
  table.charges .num { text-align: right; font-variant-numeric: tabular-nums; }
  table.charges tr.total td { border-bottom: none; border-top: 2px solid #1b3b5f; font-weight: 700; font-size: 13px; padding-top: 9px; }
  .parties { display: flex; gap: 28px; }
  .party { flex: 1; }
  .party h3 { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
  .party p { margin: 0 0 2px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e5e7eb; padding: 0 0 5px; }
  table.items td { padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  table.items .num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 26px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
  <header>
    <div class="brand">obana<span>Logistics</span></div>
    <div class="ref">
      ${s.reference ? `Tracking number<strong>${esc(s.reference)}</strong>` : "Shipment summary"}
      ${esc(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }))}
    </div>
  </header>

  <h2>Shipment</h2>
  <table class="facts">
    <tr><td>Route</td><td>${esc(s.route)}</td></tr>
    <tr><td>Service</td><td>${esc(s.service)}</td></tr>
    <tr><td>Total weight</td><td>${esc(s.weight)}</td></tr>
  </table>

  <h2>Charges</h2>
  <table class="charges">${s.charges.map(row).join("")}</table>

  <h2>Addresses</h2>
  <div class="parties">
    ${addressBlock("Pickup", s.pickup)}
    ${addressBlock("Delivery", s.delivery)}
  </div>

  ${
		s.items.length
			? `<h2>Items</h2>
  <table class="items">
    <tr><th>Description</th><th class="num">Weight</th><th class="num">Value</th></tr>
    ${s.items
			.map(
				(i) =>
					`<tr><td>${esc(i.name)}</td><td class="num">${esc(i.weight)}</td><td class="num">${esc(i.value)}</td></tr>`,
			)
			.join("")}
  </table>`
			: ""
	}

  <footer>
    ${s.reference ? "Obana Logistics." : "This is a summary of a shipment being booked, not a receipt."}
    Customs duties and clearance charges at the destination are not included unless stated above.
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
