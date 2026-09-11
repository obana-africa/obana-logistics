import type { Samples } from "@/components/docs/CodeBlock";

// Copy-paste examples for the developer docs. Values are illustrative; field names match the API exactly.

export const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "https://obana-logistics-t6qg.onrender.com").replace(/\/+$/, "");

const B = BASE_URL;

// ─── Quickstart ──────────────────────────────────────────────────────────────

export const testKey: Samples = {
	curl: `curl ${B}/stores/me \\
  -H "Authorization: Bearer $OBANA_API_KEY"`,
	node: `// Node.js 18+ (fetch is built in). Run this on your server.
const res = await fetch("${B}/stores/me", {
  headers: { Authorization: "Bearer " + process.env.OBANA_API_KEY },
});
const body = await res.json();
if (!res.ok) throw new Error(body.message);

console.log(body.data.name); // your store's name`,
	python: `import os
import requests

res = requests.get(
    "${B}/stores/me",
    headers={"Authorization": f"Bearer {os.environ['OBANA_API_KEY']}"},
    timeout=15,
)
res.raise_for_status()
print(res.json()["data"]["name"])  # your store's name`,
	php: `<?php
$ch = curl_init("${B}/stores/me");
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("OBANA_API_KEY")],
    CURLOPT_RETURNTRANSFER => true,
]);
$body = json_decode(curl_exec($ch), true);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

echo $status === 200 ? $body["data"]["name"] : $body["message"];`,
};

export const storesMeResponse = `{
  "status": "success",
  "data": {
    "id": 12,
    "name": "Ade Fashion",
    "website_url": "https://adefashion.ng",
    "status": "active",
    "api_key_hint": "obk_live_…9f3a",
    "api_key_created_at": "2026-09-01T10:12:00.000Z",
    "last_used_at": "2026-09-11T08:30:00.000Z",
    "webhook_url": "https://adefashion.ng/webhooks/obana",
    "created_at": "2026-09-01T10:12:00.000Z"
  }
}`;

// ─── Authentication & responses ──────────────────────────────────────────────

export const authHeader = `Authorization: Bearer obk_live_your_store_key`;

export const forbiddenResponse = `{
  "status": "error",
  "code": null,
  "message": "Store API keys can only be used for quotes, shipments and tracking"
}`;

export const successEnvelope = `{
  "status": "success",
  "data": { … }
}`;

export const errorEnvelope = `{
  "status": "error",
  "message": "Weight must be between 0.1 and 1000 kg"
}`;

export const validationError = `{
  "success": false,
  "message": "Invalid payload",
  "errors": [
    "pickup_address.phone is required",
    "delivery_address.city is required"
  ]
}`;

// ─── Quote ───────────────────────────────────────────────────────────────────

export const quote: Samples = {
	curl: `curl -X POST ${B}/routes/quote \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin": { "country": "United Kingdom", "country_code": "GB", "state": "England", "city": "London" },
    "destination": { "country": "Nigeria", "country_code": "NG", "state": "Lagos", "state_code": "LA", "city": "Ikeja" },
    "weight_kg": 2.5,
    "declared_value": 85000,
    "display_currency": "GBP"
  }'`,
	node: `const res = await fetch("${B}/routes/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    origin: { country: "United Kingdom", country_code: "GB", state: "England", city: "London" },
    destination: { country: "Nigeria", country_code: "NG", state: "Lagos", state_code: "LA", city: "Ikeja" },
    weight_kg: 2.5,
    declared_value: 85000, // NGN, optional
    display_currency: "GBP", // optional
  }),
});
const body = await res.json();
if (!res.ok) throw new Error(body.message);

const { options, cheapest_id } = body.data;
const cheapest = options.find((o) => o.id === cheapest_id);
console.log(cheapest.carrier_name, cheapest.price, cheapest.eta);`,
	python: `import requests

res = requests.post("${B}/routes/quote", json={
    "origin": {"country": "United Kingdom", "country_code": "GB", "state": "England", "city": "London"},
    "destination": {"country": "Nigeria", "country_code": "NG", "state": "Lagos", "state_code": "LA", "city": "Ikeja"},
    "weight_kg": 2.5,
    "declared_value": 85000,
    "display_currency": "GBP",
}, timeout=15)
res.raise_for_status()

data = res.json()["data"]
cheapest = next(o for o in data["options"] if o["id"] == data["cheapest_id"])
print(cheapest["carrier_name"], cheapest["price"], cheapest["eta"])`,
	php: `<?php
$payload = [
    "origin" => ["country" => "United Kingdom", "country_code" => "GB", "state" => "England", "city" => "London"],
    "destination" => ["country" => "Nigeria", "country_code" => "NG", "state" => "Lagos", "state_code" => "LA", "city" => "Ikeja"],
    "weight_kg" => 2.5,
    "declared_value" => 85000,
    "display_currency" => "GBP",
];

$ch = curl_init("${B}/routes/quote");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
]);
$data = json_decode(curl_exec($ch), true)["data"];

foreach ($data["options"] as $option) {
    echo $option["carrier_name"] . ": NGN " . $option["price"] . " (" . $option["eta"] . ")" . PHP_EOL;
}`,
};

export const quoteResponse = `{
  "status": "success",
  "data": {
    "currency": "NGN",
    "display_currency": "GBP",
    "fx": { "rate": 0.00047, "as_of": "2026-09-11T06:00:00.000Z", "source": "open.er-api.com" },
    "options": [
      {
        "id": "obana-air-express",
        "provider": "obana",
        "carrier_name": "Obana Logistics",
        "logo_url": null,
        "transport_mode": "air",
        "service_level": "Express",
        "eta": "5-7 days",
        "price": 88000,
        "display_price": 41.36
      },
      {
        "id": "partner-dhl-0",
        "provider": "partner",
        "carrier_name": "DHL Express",
        "logo_url": "https://…/dhl.png",
        "transport_mode": null,
        "service_level": null,
        "eta": "3-5 days",
        "price": 96500,
        "display_price": 45.36
      }
    ],
    "cheapest_id": "obana-air-express",
    "fastest_id": "partner-dhl-0",
    "expires_at": "2026-09-11T09:30:00.000Z"
  }
}`;

// ─── Create a shipment ───────────────────────────────────────────────────────

const shipmentJson = `{
  "order_id": "SO-1042",
  "customer": {
    "id": "cus_8812",
    "name": "Chioma Okafor",
    "email": "chioma@example.com",
    "phone": "+2348031234567"
  },
  "quote_option_id": "obana-road-standard",
  "pickup_address": {
    "contact_name": "Ade Fashion Warehouse",
    "line1": "12 Allen Avenue",
    "city": "Ikeja",
    "state": "Lagos",
    "country": "Nigeria",
    "phone": "+2348012345678",
    "email": "dispatch@adefashion.ng"
  },
  "delivery_address": {
    "first_name": "Chioma",
    "last_name": "Okafor",
    "line1": "7 Ring Road",
    "city": "Ibadan",
    "state": "Oyo",
    "country": "Nigeria",
    "phone": "+2348031234567",
    "email": "chioma@example.com"
  },
  "items": [
    { "name": "Ankara dress", "quantity": 2, "weight": 0.6, "price": 18500 }
  ],
  "transport_mode": "road",
  "service_level": "Standard"
}`;

const indent = (text: string, spaces: number) => text.split("\n").join("\n" + " ".repeat(spaces));

export const createShipment: Samples = {
	curl: `curl -X POST ${B}/shipments \\
  -H "Authorization: Bearer $OBANA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${indent(shipmentJson, 2)}'`,
	node: `// Call this when an order is paid. Reusing order_id makes retries safe.
const shipment = {
  order_id: "SO-1042",
  customer: { id: "cus_8812", name: "Chioma Okafor", email: "chioma@example.com", phone: "+2348031234567" },
  quote_option_id: "obana-road-standard", // from /routes/quote (optional)
  pickup_address: {
    contact_name: "Ade Fashion Warehouse",
    line1: "12 Allen Avenue",
    city: "Ikeja",
    state: "Lagos",
    country: "Nigeria",
    phone: "+2348012345678",
  },
  delivery_address: {
    first_name: "Chioma",
    last_name: "Okafor",
    line1: "7 Ring Road",
    city: "Ibadan",
    state: "Oyo",
    country: "Nigeria",
    phone: "+2348031234567",
  },
  items: [{ name: "Ankara dress", quantity: 2, weight: 0.6, price: 18500 }],
  transport_mode: "road",
  service_level: "Standard",
};

const res = await fetch("${B}/shipments", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.OBANA_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(shipment),
});
const body = await res.json();
if (!res.ok) throw new Error(body.message + " " + (body.errors || []).join(", "));

console.log(body.data.shipment_reference, body.data.tracking_url);`,
	python: `import os
import requests

shipment = {
    "order_id": "SO-1042",  # reusing it makes retries safe
    "customer": {"id": "cus_8812", "name": "Chioma Okafor", "email": "chioma@example.com", "phone": "+2348031234567"},
    "quote_option_id": "obana-road-standard",  # from /routes/quote (optional)
    "pickup_address": {
        "contact_name": "Ade Fashion Warehouse",
        "line1": "12 Allen Avenue",
        "city": "Ikeja",
        "state": "Lagos",
        "country": "Nigeria",
        "phone": "+2348012345678",
    },
    "delivery_address": {
        "first_name": "Chioma",
        "last_name": "Okafor",
        "line1": "7 Ring Road",
        "city": "Ibadan",
        "state": "Oyo",
        "country": "Nigeria",
        "phone": "+2348031234567",
    },
    "items": [{"name": "Ankara dress", "quantity": 2, "weight": 0.6, "price": 18500}],
    "transport_mode": "road",
    "service_level": "Standard",
}

res = requests.post(
    "${B}/shipments",
    json=shipment,
    headers={"Authorization": f"Bearer {os.environ['OBANA_API_KEY']}"},
    timeout=30,
)
body = res.json()
if not res.ok:
    raise RuntimeError(f"{body['message']} {body.get('errors', [])}")

print(body["data"]["shipment_reference"], body["data"]["tracking_url"])`,
	php: `<?php
$shipment = [
    "order_id" => "SO-1042", // reusing it makes retries safe
    "customer" => ["id" => "cus_8812", "name" => "Chioma Okafor", "email" => "chioma@example.com", "phone" => "+2348031234567"],
    "quote_option_id" => "obana-road-standard", // from /routes/quote (optional)
    "pickup_address" => [
        "contact_name" => "Ade Fashion Warehouse",
        "line1" => "12 Allen Avenue",
        "city" => "Ikeja",
        "state" => "Lagos",
        "country" => "Nigeria",
        "phone" => "+2348012345678",
    ],
    "delivery_address" => [
        "first_name" => "Chioma",
        "last_name" => "Okafor",
        "line1" => "7 Ring Road",
        "city" => "Ibadan",
        "state" => "Oyo",
        "country" => "Nigeria",
        "phone" => "+2348031234567",
    ],
    "items" => [["name" => "Ankara dress", "quantity" => 2, "weight" => 0.6, "price" => 18500]],
    "transport_mode" => "road",
    "service_level" => "Standard",
];

$ch = curl_init("${B}/shipments");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("OBANA_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($shipment),
    CURLOPT_RETURNTRANSFER => true,
]);
$body = json_decode(curl_exec($ch), true);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($status >= 400) {
    throw new RuntimeException($body["message"] . " " . implode(", ", $body["errors"] ?? []));
}
echo $body["data"]["shipment_reference"] . " " . $body["data"]["tracking_url"];`,
};

export const createResponse = `{
  "success": true,
  "message": "Shipment created successfully",
  "data": {
    "shipment_id": 5821,
    "shipment_reference": "OBN-7F3K2Q",
    "order_id": "SO-1042",
    "shipping_fee": 6500,
    "currency": "NGN",
    "tracking_url": "https://logistics.obana.africa/?track=OBN-7F3K2Q",
    "carrier": "Obana Logistics",
    "status": "confirmed",
    "estimated_delivery": "2-3 days"
  }
}`;

export const duplicateResponse = `{
  "success": true,
  "duplicate": true,
  "message": "A shipment already exists for this order",
  "data": {
    "id": 5821,
    "shipment_reference": "OBN-7F3K2Q",
    "status": "pending",
    "shipping_fee": 6500,
    "currency": "NGN"
  }
}`;

export const routeError = `{
  "success": false,
  "message": "We don't deliver on this route yet. Contact us to add it."
}`;

// ─── List shipments ──────────────────────────────────────────────────────────

function listSamples(query: Record<string, string>): Samples {
	const qs = new URLSearchParams(query).toString();
	const js = Object.entries(query)
		.map(([k, v]) => `${k}: "${v}"`)
		.join(", ");
	const py = Object.entries(query)
		.map(([k, v]) => `"${k}": "${v}"`)
		.join(", ");
	const php = Object.entries(query)
		.map(([k, v]) => `"${k}" => "${v}"`)
		.join(", ");
	return {
		curl: `curl "${B}/stores/me/shipments?${qs}" \\
  -H "Authorization: Bearer $OBANA_API_KEY"`,
		node: `const params = new URLSearchParams({ ${js} });
const res = await fetch("${B}/stores/me/shipments?" + params, {
  headers: { Authorization: "Bearer " + process.env.OBANA_API_KEY },
});
const { data } = await res.json();

for (const s of data.shipments) console.log(s.reference, s.order_id, s.status);
console.log("total:", data.pagination.total);`,
		python: `import os
import requests

res = requests.get(
    "${B}/stores/me/shipments",
    params={${py}},
    headers={"Authorization": f"Bearer {os.environ['OBANA_API_KEY']}"},
    timeout=15,
)
data = res.json()["data"]

for s in data["shipments"]:
    print(s["reference"], s["order_id"], s["status"])
print("total:", data["pagination"]["total"])`,
		php: `<?php
$query = http_build_query([${php}]);
$ch = curl_init("${B}/stores/me/shipments?" . $query);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("OBANA_API_KEY")],
    CURLOPT_RETURNTRANSFER => true,
]);
$data = json_decode(curl_exec($ch), true)["data"];

foreach ($data["shipments"] as $s) {
    echo $s["reference"] . " " . $s["order_id"] . " " . $s["status"] . PHP_EOL;
}`,
	};
}

export const listAll = listSamples({ page: "1", limit: "20" });
export const listByCustomer = listSamples({ customer_id: "cus_8812" });
export const listByOrder = listSamples({ order_id: "SO-1042" });
export const listInTransit = listSamples({ status: "in_transit", limit: "100" });

const shipmentObject = `{
  "id": 5821,
  "reference": "OBN-7F3K2Q",
  "order_id": "SO-1042",
  "status": "in_transit",
  "customer": {
    "id": "cus_8812",
    "name": "Chioma Okafor",
    "email": "chioma@example.com",
    "phone": "+2348031234567"
  },
  "carrier": { "type": "obana", "name": "Obana Logistics" },
  "shipping_fee": 6500,
  "currency": "NGN",
  "tracking_url": "https://logistics.obana.africa/?track=OBN-7F3K2Q",`;

export const listResponse = `{
  "status": "success",
  "data": {
    "shipments": [
      ${indent(shipmentObject, 6)}
        "destination": { "name": "Chioma Okafor", "city": "Ibadan", "state": "Oyo", "country": "Nigeria" },
        "created_at": "2026-09-10T14:02:11.000Z",
        "updated_at": "2026-09-11T09:40:03.000Z"
      }
    ],
    "pagination": { "total": 1, "page": 1, "pages": 1, "limit": 20 }
  }
}`;

// ─── Track & cancel ──────────────────────────────────────────────────────────

export const track: Samples = {
	curl: `curl ${B}/shipments/track/OBN-7F3K2Q \\
  -H "Authorization: Bearer $OBANA_API_KEY"`,
	node: `const reference = "OBN-7F3K2Q";
const res = await fetch("${B}/shipments/track/" + encodeURIComponent(reference), {
  headers: { Authorization: "Bearer " + process.env.OBANA_API_KEY },
});
const body = await res.json();
if (!res.ok) throw new Error(body.message);

console.log(body.data.status, body.data.tracking_events[0]);`,
	python: `import os
import requests

res = requests.get(
    "${B}/shipments/track/OBN-7F3K2Q",
    headers={"Authorization": f"Bearer {os.environ['OBANA_API_KEY']}"},
    timeout=15,
)
res.raise_for_status()
shipment = res.json()["data"]
print(shipment["status"], shipment["tracking_events"][:1])`,
	php: `<?php
$ch = curl_init("${B}/shipments/track/" . rawurlencode("OBN-7F3K2Q"));
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("OBANA_API_KEY")],
    CURLOPT_RETURNTRANSFER => true,
]);
$shipment = json_decode(curl_exec($ch), true)["data"];

echo $shipment["status"];`,
};

export const trackResponse = `{
  "success": true,
  "data": {
    "id": 5821,
    "shipment_reference": "OBN-7F3K2Q",
    "status": "in_transit",
    "shipping_fee": 6500,
    "currency": "NGN",
    "pickup_address": { "city": "Ikeja", "state": "Lagos", … },
    "delivery_address": { "city": "Ibadan", "state": "Oyo", … },
    "items": [ { "name": "Ankara dress", "quantity": 2, … } ],
    "tracking_events": [
      { "status": "in_transit", "description": "…", "createdAt": "2026-09-11T09:40:03.000Z" },
      { "status": "picked_up", "description": "…", "createdAt": "2026-09-11T07:15:40.000Z" }
    ]
  }
}`;

export const cancel: Samples = {
	curl: `curl -X POST ${B}/shipments/cancel/5821 \\
  -H "Authorization: Bearer $OBANA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "reason": "Customer cancelled the order" }'`,
	node: `const shipmentId = 5821; // shipment_id from the create response
const res = await fetch("${B}/shipments/cancel/" + shipmentId, {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.OBANA_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ reason: "Customer cancelled the order" }),
});
const body = await res.json();
if (!res.ok) throw new Error(body.message); // e.g. already picked up`,
	python: `import os
import requests

res = requests.post(
    "${B}/shipments/cancel/5821",
    json={"reason": "Customer cancelled the order"},
    headers={"Authorization": f"Bearer {os.environ['OBANA_API_KEY']}"},
    timeout=15,
)
if not res.ok:
    raise RuntimeError(res.json()["message"])  # e.g. already picked up`,
	php: `<?php
$ch = curl_init("${B}/shipments/cancel/5821");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("OBANA_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(["reason" => "Customer cancelled the order"]),
    CURLOPT_RETURNTRANSFER => true,
]);
$body = json_decode(curl_exec($ch), true);

echo $body["message"];`,
};

export const cancelResponse = `{
  "success": true,
  "message": "Shipment cancelled successfully"
}`;

// ─── Webhooks ────────────────────────────────────────────────────────────────

export const webhookRequest = `POST /webhooks/obana HTTP/1.1
Content-Type: application/json
User-Agent: Obana-Webhooks/1.0
Obana-Event: shipment.updated
Obana-Delivery: 90211
Obana-Signature: t=1789119603,v1=5f2c8e0b…`;

export const webhookPayload = `{
  "id": "evt_4b1f0c2e9a7d31f6c8e2b5a0",
  "event": "shipment.updated",
  "created_at": "2026-09-11T09:40:03.512Z",
  "data": {
    "shipment": ${indent(shipmentObject, 4)}
      "created_at": "2026-09-10T14:02:11.000Z",
      "updated_at": "2026-09-11T09:40:03.000Z"
    }
  }
}`;

export const verify: Samples = {
	node: `// npm install express
const express = require("express");
const crypto = require("crypto");

const app = express();
const WEBHOOK_SECRET = process.env.OBANA_WEBHOOK_SECRET; // whsec_…
const TOLERANCE_SECONDS = 5 * 60;

function isValidSignature(rawBody, header) {
  const parts = Object.fromEntries(
    String(header || "").split(",").map((part) => part.trim().split("="))
  );
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t)) return false;
  // Too old (or from the future): could be a replay.
  if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(t + "." + rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// express.raw keeps the exact bytes we signed. Don't use express.json() on this route.
app.post("/webhooks/obana", express.raw({ type: "application/json" }), (req, res) => {
  const raw = req.body.toString("utf8");
  if (!isValidSignature(raw, req.get("Obana-Signature"))) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(raw);
  res.sendStatus(200); // reply first, then do the work

  if (event.event === "shipment.created" || event.event === "shipment.updated") {
    const shipment = event.data.shipment;
    // Skip if you've handled event.id before, or already hold a newer shipment.updated_at.
    console.log(shipment.reference, shipment.status);
  }
});

app.listen(3000);`,
	python: `# pip install flask
import hashlib
import hmac
import json
import os
import time

from flask import Flask, abort, request

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["OBANA_WEBHOOK_SECRET"]  # whsec_…
TOLERANCE_SECONDS = 5 * 60


def is_valid_signature(raw_body: bytes, header: str) -> bool:
    parts = dict(p.strip().split("=", 1) for p in header.split(",") if "=" in p)
    try:
        t = int(parts["t"])
    except (KeyError, ValueError):
        return False
    # Too old (or from the future): could be a replay.
    if abs(time.time() - t) > TOLERANCE_SECONDS:
        return False
    signed = f"{t}.".encode() + raw_body
    expected = hmac.new(WEBHOOK_SECRET.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))


@app.post("/webhooks/obana")
def obana_webhook():
    raw = request.get_data()  # the exact bytes we signed
    if not is_valid_signature(raw, request.headers.get("Obana-Signature", "")):
        abort(400)

    event = json.loads(raw)
    if event["event"] in ("shipment.created", "shipment.updated"):
        shipment = event["data"]["shipment"]
        # Skip if you've handled event["id"] before, or already hold a newer shipment["updated_at"].
        print(shipment["reference"], shipment["status"])
    return "", 200`,
	php: `<?php
// webhooks/obana.php
$secret = getenv("OBANA_WEBHOOK_SECRET"); // whsec_…
$tolerance = 5 * 60;

$raw = file_get_contents("php://input"); // the exact bytes we signed
$header = $_SERVER["HTTP_OBANA_SIGNATURE"] ?? "";

$parts = [];
foreach (explode(",", $header) as $part) {
    [$key, $value] = array_pad(explode("=", trim($part), 2), 2, "");
    $parts[$key] = $value;
}
$t = (int) ($parts["t"] ?? 0);
$expected = hash_hmac("sha256", $t . "." . $raw, $secret);

// Reject bad signatures and anything older than 5 minutes (could be a replay).
if (!$t || abs(time() - $t) > $tolerance || !hash_equals($expected, $parts["v1"] ?? "")) {
    http_response_code(400);
    exit("Invalid signature");
}

$event = json_decode($raw, true);
http_response_code(200);

if (in_array($event["event"], ["shipment.created", "shipment.updated"], true)) {
    $shipment = $event["data"]["shipment"];
    // Skip if you've handled $event["id"] before, or already hold a newer $shipment["updated_at"].
    error_log($shipment["reference"] . " " . $shipment["status"]);
}`,
};
