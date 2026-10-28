/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Alert, Card, Button, Input, Select } from '@/components/ui';
import { apiClient, type SavedQuote } from '@/lib/api';
import { formatMoney, showPhone } from '@/lib/shipments';
import { useRemote } from '@/lib/useRemote';
import { clearPendingQuote } from '@/components/quote/quote';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Package, MapPin, Truck, Clock, AlertCircle, X, MessageCircle, Mail, PackageSearch, Download } from 'lucide-react';
import { SUPPORT_EMAIL, supportPhoneDisplay, whatsappLink } from '@/lib/site';
import { LocationInput } from '@/components/LocationInput';
import { NIGERIAN_STATES } from '@/lib/nigerianStates';
import PhoneInput from '@/components/PhoneInput';
import DocumentPicker from '@/components/shipments/DocumentPicker';
import { asDataUrl, type PendingDocument, uploadFailureReason } from '@/lib/shipmentDocuments';
import { printShipmentSummary } from '@/lib/shipmentSummaryPdf';

// Arriving from the public quote page (?pickup_city=…&delivery_city=…&weight=4.5): start with that route and weight.
const subscribeNothing = () => () => {};
const readSearch = () => window.location.search;

function withQuotePrefill<T extends { pickup_address: object; delivery_address: object; items: { weight: string }[] }>(form: T, search: string): T {
	const q = new URLSearchParams(search);
	const place = (side: "pickup" | "delivery") => {
		const city = q.get(`${side}_city`)?.trim();
		if (!city) return {};
		return {
			city,
			state: q.get(`${side}_state`) ?? "",
			stateCode: q.get(`${side}_state_code`) ?? "",
			country: q.get(`${side}_country`) ?? "",
			countryCode: (q.get(`${side}_country_code`) ?? "").toUpperCase(),
		};
	};
	const kg = parseFloat(q.get("weight") ?? "");
	return {
		...form,
		pickup_address: { ...form.pickup_address, ...place("pickup") },
		delivery_address: { ...form.delivery_address, ...place("delivery") },
		items: kg > 0 && kg <= 1000 ? form.items.map((item, i) => (i === 0 ? { ...item, weight: String(kg) } : item)) : form.items,
	};
}

// Only what the courier needs: where, who to call and what's in the box. Service and price are picked on step 2.
/* Quantity is no longer asked for. A sender knows what the parcel weighs, not
   what one of several identical things inside it weighs, so the form takes the
   packed weight and the API — which prices on weight × quantity — is handed a
   quantity of one. */
const emptyItem = () => ({ name: '', quantity: '1', weight: '', price: '' });
const emptyForm = () => ({
  pickup_address: { line1: '', city: '', state: '', country: '', countryCode: '', stateCode: '', phone: '', contact_name: '' },
  delivery_address: { line1: '', city: '', state: '', country: '', countryCode: '', stateCode: '', phone: '', name: '', email: '' },
  /* Where an international consignment lands before the last stretch inland.
     Blank means one journey, which is every shipment until somebody says
     otherwise. */
  arrival: { state: '' },
  items: [emptyItem()],
});

type Form = ReturnType<typeof emptyForm>;
type Item = ReturnType<typeof emptyItem>;

/** One price the customer can book: a service on our own route, or a partner carrier's rate. */
type PriceOption = {
  id: string;
  transport_mode: string;
  service_level: string;
  price: number;
  /* The two halves of that price: the delivery, and Obana's service charge.
     Shown apart because a total nobody can take apart cannot be checked. */
  base_price?: number;
  service_charge?: number;
  service_charge_percent?: number;
  /* Two journeys on one booking: the crossing, then the run to the door.
     Present only where the international lane names an arrival city. */
  legs?: { kind: 'international' | 'local'; from?: string; to?: string; base_price: number }[];
  eta?: string | null;
  estimated_delivery?: string | null;
  preferred_driver?: { id: number | string; driver_code?: string; vehicle_type?: string } | null;
  carrier?: string;
  /** The saved quote's price, which the server honours for this booking. */
  held?: boolean;
};

// Same spellings rule as the server ("Lagos State" = "Lagos").
const normalizeState = (s: string) => s.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/ state$/, '');

const splitName = (full: string) => {
  const [first_name = '', ...rest] = full.trim().split(/\s+/);
  return { first_name, last_name: rest.join(' ') };
};

export type NewShipmentFormProps = {
	/** Whose dashboard chrome to render around the form. */
	role?: 'customer' | 'admin';
	/** Set when an administrator is booking for someone — the customer's user id. */
	onBehalfOf?: string;
	/** Shown in the header so the admin can see who they are booking for. */
	onBehalfOfName?: string;
	/** Optional control rendered in the header — the admin's "create for" picker. */
	customerPicker?: React.ReactNode;
};

export default function NewShipmentForm({ role = 'customer', onBehalfOf, onBehalfOfName, customerPicker }: NewShipmentFormProps) {
	const listHref = role === 'admin' ? '/dashboard/admin/shipments' : '/dashboard/customer/shipments';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* Which kind of failure, from the API's `code`. A route we don't run is not
     the same event as a form mistake or a carrier timing out, and the way out
     of each one is different — so the modal needs to know which it is. */
  const [errorCode, setErrorCode] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newShipmentInfo, setNewShipmentInfo] = useState<any>(null);
  /* Chosen while booking, uploaded the moment the shipment has an id. */
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [docStatus, setDocStatus] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  /* The waybill number as typed in the documents box, which travels with the
     booking whether or not a file is ever chosen. */
  const [typedAwb, setTypedAwb] = useState("");
  const [booksResult, setBooksResult] = useState<any>(null);
  const [matchedRoute, setMatchedRoute] = useState<any>(null);

  /* An unfinished booking, and the people this account has sent to before.
     Both exist for the same reason: filling this form in is work, and the
     work was being thrown away — once by leaving the page, and once by
     typing the same customer's details again next week. */
  const [draftId, setDraftId] = useState<number | string | null>(null);
  const [drafts, setDrafts] = useState<{ id: number; label: string; form: any; updated_at: string }[]>([]);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);
  // The price picked on step 2; null means the first (cheapest) one.
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'match' | 'confirm'>('details');
  // After the first "Continue", show field errors live so users fix them before moving on.
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [formData, setFormData] = useState<Form>(emptyForm);
	// Apply a quote-page prefill once per incoming link. The URL is read after navigation settles
	// (window.location lags behind a client-side route change), and state is adjusted during render — no effect.
	const search = useSyncExternalStore(subscribeNothing, readSearch, () => "");
	const [prefilledFor, setPrefilledFor] = useState("");
	if (search !== prefilledFor) {
		setPrefilledFor(search);
		setFormData((prev) => withQuotePrefill(prev, search));
	}

  // Booking from a saved quote (?quote=Q-…&option=…): its option is pre-selected, and while the quote holds
  // (24 hours, same route, no heavier than quoted) its price is what the server charges.
  const quoteParams = new URLSearchParams(search);
  const quoteRef = quoteParams.get('quote');
  const quotedOptionId = quoteParams.get('option');
  const savedQuote = useRemote<SavedQuote | null>(quoteRef && `quote:${quoteRef}`, async () => (await apiClient.getQuote(quoteRef as string)).data ?? null);

  const setPickup = (patch: Partial<Form['pickup_address']>) =>
    setFormData((prev) => ({ ...prev, pickup_address: { ...prev.pickup_address, ...patch } }));
  const setDelivery = (patch: Partial<Form['delivery_address']>) =>
    setFormData((prev) => ({ ...prev, delivery_address: { ...prev.delivery_address, ...patch } }));
  const setItem = (index: number, patch: Partial<Item>) =>
    setFormData((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  // Quantity is always 1 now; the weight entered is the packed weight.
  const shipmentWeight = formData.items.reduce(
    (sum, item) => sum + (parseFloat(item.weight) || 0.5) * (parseInt(item.quantity) || 1),
    0
  );

  /* How many things are being sent, for the per-unit rate. Quantity is always
     1 on this form, so this is the number of lines — two cartons read as two
     units, which is what a per-unit rate is asking about. */
  const totalUnits = formData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);

  /* Loaded once, quietly. Neither is worth an error if it fails: a booking
     can be made without a draft list and without a previous customer. */
  useEffect(() => {
    apiClient.listShipmentDrafts().then((r) => setDrafts(r?.data ?? [])).catch(() => {});
    apiClient.getRecentCustomers().then((r) => setCustomers(r?.data ?? [])).catch(() => {});
  }, []);

  const saveDraft = async () => {
    setDraftState('saving');
    try {
      /* The waybill is held apart from the form — it is typed in the
         documents box, not the address boxes — so a draft saved without it
         lost the one thing somebody had just gone to look up. */
      const saved = await apiClient.saveShipmentDraft({
        id: draftId ?? undefined,
        form: { ...formData, typed_awb: typedAwb },
      });
      if (saved?.data?.id) setDraftId(saved.data.id);
      setDrafts((prev) => {
        const without = prev.filter((d) => d.id !== saved?.data?.id);
        return saved?.data ? [saved.data, ...without] : prev;
      });
      setDraftState('saved');
      setTimeout(() => setDraftState('idle'), 2500);
    } catch (err: any) {
      setDraftState('idle');
      showError(err?.response?.data?.message || 'That draft could not be saved. Please try again.');
    }
  };

  /* Continuing a draft restores the form and nothing else. The price is not
     among it: a figure quoted a week ago is not a figure we can still honour,
     so the route is matched again from the addresses that come back. */
  const continueDraft = (draft: { id: number; form: any }) => {
    const { typed_awb: savedAwb, ...form } = draft.form ?? {};
    setFormData({ ...emptyForm(), ...form });
    setTypedAwb(savedAwb ?? '');
    setDraftId(draft.id);
    setMatchedRoute(null);
    setSelectedOptionId(null);
    setStep('details');
  };

  const useCustomer = (c: any) => {
    setFormData((prev) => ({
      ...prev,
      delivery_address: {
        ...prev.delivery_address,
        name: c.name || '', phone: c.phone || '', email: c.email || '',
        line1: c.line1 || '', city: c.city || '', state: c.state || '',
        country: c.country || '', countryCode: prev.delivery_address.countryCode,
      },
    }));
    setShowCustomers(false);
  };

  const quote = savedQuote.data;
  const quoteHolds = !!quote && !quote.expired && quote.status === 'quoted';
  const samePlace = (place: { state: string; countryCode: string }, saved: { state: string; country_code: string }) =>
    place.countryCode.toUpperCase() === saved.country_code.toUpperCase() && normalizeState(place.state) === normalizeState(saved.state);
  const heldOption =
    quote && quoteHolds && samePlace(formData.pickup_address, quote.origin) && samePlace(formData.delivery_address, quote.destination) && shipmentWeight <= quote.weight_kg + 0.01
      ? quote.options.find((o) => o.id === quotedOptionId && o.provider === 'obana') ?? null
      : null;

  // Every service the server priced for this route, cheapest first. A partner rate (or a lone route price) is one option.
  const crossBorder = formData.pickup_address.countryCode !== formData.delivery_address.countryCode;

  /* Naira with the dollars beside it, on a shipment that crosses a border.
  
     The rate is the server's — Zoho's, the same one the shipment summary and
     the WhatsApp message will use — because a figure this screen worked out
     from a public feed would disagree with the invoice the customer is later
     sent. No rate means naira alone, which is what this screen showed before. */
  /* Quoted in the shipper's money, with the naira it converts to beside it.
     The sender is the one paying, and a naira figure is one they cannot hold
     against another forwarder without first going to find a rate — which will
     not be ours. Base first, charged second. Both from the server: a rate this
     screen fetched for itself would disagree with the document and the
     message. */
  /* "Abriola, Basilicata (Italy)" — the one spelling of a place, used by the
     route on screen and the route on paper. */
  const placeName = (a: { city?: string; state?: string; country?: string }) =>
    [a.city, a.state].filter(Boolean).join(', ') + (crossBorder && a.country ? ` (${a.country})` : '');

  const baseCurrency: string = matchedRoute?.base_currency || '';
  const nairaPerBase = Number(matchedRoute?.naira_per_base) || 0;
  const converts = crossBorder && Boolean(baseCurrency) && nairaPerBase > 0;
  const withUsd = (amount: number) => {
    const naira = formatMoney(amount, 'NGN');
    if (!converts || !(amount > 0)) return naira;
    return `${formatMoney(amount / nairaPerBase, baseCurrency)} (${naira})`;
  };
  const priceOptions: PriceOption[] = !matchedRoute
    ? []
    : matchedRoute.options?.length
      ? matchedRoute.options.map((o: PriceOption) =>
          heldOption && o.id === heldOption.id
            ? {
                ...o,
                price: heldOption.price,
                /* The quoted price came with its own split; using this option's
                   would show parts that do not add up to the total charged. */
                base_price: heldOption.base_price ?? o.base_price,
                service_charge: heldOption.service_charge ?? o.service_charge,
                service_charge_percent: heldOption.service_charge_percent ?? o.service_charge_percent,
                held: true,
              }
            : o,
        )
      : [{
          id: 'only',
          transport_mode: matchedRoute.service?.transport_mode || (crossBorder ? 'air' : 'road'),
          service_level: matchedRoute.service?.service_level || 'Standard',
          price: Number(matchedRoute.match?.price),
          base_price: matchedRoute.match?.base_price,
          service_charge: matchedRoute.match?.service_charge,
          service_charge_percent: matchedRoute.match?.service_charge_percent,
          eta: matchedRoute.match?.eta,
          estimated_delivery: matchedRoute.match?.estimated_delivery,
          preferred_driver: matchedRoute.external ? null : matchedRoute.preferred_driver,
          carrier: matchedRoute.external ? matchedRoute.carrier?.name : undefined,
        }];
  const selected = priceOptions.find((o) => o.id === selectedOptionId) ?? priceOptions.find((o) => o.id === quotedOptionId) ?? priceOptions[0];

  const deliveryAddress = () => {
    const { name, ...rest } = formData.delivery_address;
    return { ...rest, ...splitName(name) };
  };
  const itemsPayload = () =>
    formData.items.map((item) => ({
      name: item.name.trim(),
      quantity: parseInt(item.quantity) || 1,
      weight: parseFloat(item.weight) || 0.5,
      /* Zero, never NaN: JSON turns NaN into null and the columns behind these
         two are NOT NULL, so a blank box would be refused by the database
         rather than simply left unsaid. */
      price: parseFloat(item.price) || 0,
      total_price: parseFloat(item.price) || 0,
    }));

  /* What the sender is trying to do, in a sentence — so a message to us
     arrives with the route already in it and nobody has to ask for it. */
  const laneText = () => {
    const where = (a: { city: string; state: string }) => [a.city, a.state].filter(Boolean).join(', ') || 'somewhere';
    return `${where(formData.pickup_address)} to ${where(formData.delivery_address)}`;
  };
  const askText = () =>
    `Hello Obana, I'd like to send a shipment from ${laneText()}` +
    (shipmentWeight > 0 ? ` (about ${shipmentWeight}kg)` : '') +
    '. Can your team arrange it?';

  /* A route gap and a carrier that didn't answer both leave the sender stuck,
     and both are fixed by a person — so both get the contact. */
  const canContactUs = errorCode === 'route_unavailable' || errorCode === 'carrier_unreachable';

  const errorTitle =
    errorCode === 'route_unavailable'
      ? role === 'admin'
        ? 'No route covers this yet'
        : "We don't cover this route yet"
      : errorCode === 'carrier_unreachable'
        ? "We couldn't get a price just now"
        : 'That didn\u2019t go through';

  const showError = (message: string, code = '') => {
    setError(message);
    setErrorCode(code);
    setShowErrorModal(true);
  };

  const closeErrorModal = () => {
    setShowErrorModal(false);
    // Don't clear error message so it can still be seen after modal closes if needed
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setError('');
    setMatchedRoute(null);
    setSelectedOptionId(null);
    setStep('details');
    setShowFieldErrors(false);
    setShowSuccessModal(false);
    setNewShipmentInfo(null);
    setPendingDocs([]);
    setDocStatus(null);
    setBooksResult(null);
  };

  // Everything the shipment needs is checked here, on step 1 — nothing should fail later at "Create shipment".
  const validateDetails = () => {
    const e: Record<string, string> = {};
    const emailOk = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    const phoneOk = (v: string) => v.replace(/\D/g, '').length >= 8;
    const p = formData.pickup_address;
    const d = formData.delivery_address;
    if (!p.country || !p.state || !p.city) e['pickup.location'] = 'Choose the pickup country, state and city.';
    if (!p.line1.trim()) e['pickup.line1'] = 'Enter the pickup street address.';
    if (!phoneOk(p.phone)) e['pickup.phone'] = 'Enter a phone number for the pickup contact.';
    if (!d.country || !d.state || !d.city) e['delivery.location'] = 'Choose the delivery country, state and city.';
    if (!d.line1.trim()) e['delivery.line1'] = 'Enter the delivery street address.';
    if (!d.name.trim()) e['delivery.name'] = "Enter the recipient's name.";
    if (!phoneOk(d.phone)) e['delivery.phone'] = "Enter the recipient's phone number.";
    if (!emailOk(d.email)) e['delivery.email'] = 'Enter a valid email address.';
    formData.items.forEach((item, i) => {
      if (!item.name.trim()) e[`item.${i}.name`] = 'Enter what this item is.';
      /* What it is worth is not asked for. It buys cover if the parcel goes
         missing and nothing else — it does not price the delivery, which is
         done on weight — so a sender who does not know, or would rather not
         say, is not stopped at the door for it. */
      if (!(parseFloat(item.weight) > 0)) e[`item.${i}.weight`] = 'Enter the weight in kg.';
    });
    return e;
  };
  const fieldErrors: Record<string, string> = showFieldErrors ? validateDetails() : {};
  const errorCount = Object.keys(fieldErrors).length;

  const handleMatchRoute = async () => {
    const found = validateDetails();
    setShowFieldErrors(true);
    if (Object.keys(found).length) {
      // Take the user to the first field that needs attention.
      requestAnimationFrame(() =>
        document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      );
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.matchRoute({
        /* So the last stretch inland is priced and quoted as its own leg
           rather than being carried for free inside the crossing. */
        arrival_city: crossBorder ? formData.arrival.state.trim() || undefined : undefined,
        arrival_state: crossBorder ? formData.arrival.state.trim() || undefined : undefined,
        pickup_address: formData.pickup_address,
        delivery_address: deliveryAddress(),
        items: itemsPayload(),
        weight: shipmentWeight,
      });
      const matched = Array.isArray(response.data) ? response.data[0] : response.data;
      if (matched) {
        setMatchedRoute(matched);
        setSelectedOptionId(null);
        setStep('match');
        setError('');
      } else {
        showError("We don't deliver on this route yet. Our team can still arrange it.", 'route_unavailable');
      }
    } catch (err: any) {
      showError(
        err.response?.data?.message || "We couldn't get prices just now. Please try again.",
        err.response?.data?.code || ''
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Put the chosen files on the shipment that now exists.
   *
   * One at a time, and a failure is reported rather than thrown: the shipment
   * is already booked by this point, and losing that behind "could not upload
   * document 2" would be the worse outcome. Whatever did not go up can be
   * attached from the shipment page.
   */
  const attachPendingDocs = async (shipmentId: string | number) => {
    const failed: string[] = [];
    setDocStatus({ done: 0, total: pendingDocs.length, failed });
    for (let i = 0; i < pendingDocs.length; i++) {
      const d = pendingDocs[i];
      try {
        await apiClient.addShipmentDocument(shipmentId, {
          file: await asDataUrl(d.file),
          name: d.file.name,
          kind: d.kind,
          note: d.note || undefined,
        });
      } catch (err) {
        /* Name the file and say why. A list of names alone sent people to the
           shipment page to try the same thing and fail the same way. */
        failed.push(`${d.file.name} — ${uploadFailureReason(err)}`);
      }
      setDocStatus({ done: i + 1, total: pendingDocs.length, failed: [...failed] });
    }
  };

  /**
   * The review screen as a document, for keeping or sending on.
   *
   * Built from the same values the screen is showing rather than fetched
   * again, so the paper and the page can never disagree about the price.
   */
  const downloadSummary = () => {
    /* Say so rather than do nothing.
    
       Both this and the confirm button used to return silently when there was
       no priced option to work from, so a customer pressed a button that
       looked live and got no reaction at all — no error, no spinner, nothing
       to tell them the page had lost its price while they were filling the
       rest in. "I cannot click" is what that looks like from the outside. */
    if (!selected) {
      showError('This page has lost the price it was working from. Go back to Prices and pick one again — nothing you have typed is lost.');
      return;
    }
    const place = (a: { line1?: string; city?: string; state?: string; country?: string; name?: string; contact_name?: string; phone?: string }) =>
      [a.name || a.contact_name, a.line1, [a.city, a.state].filter(Boolean).join(', '), a.country, showPhone(a.phone)].filter(Boolean) as string[];

    /* What a kilo costs, before what the whole thing costs — the figure a
       customer can check against the quote and against anyone else's price.
       Taken from the delivery rather than the total: the service charge is on
       the job, not on each kilo. */
    const deliveryPart = selected.base_price ?? selected.price;
    /* The same figures, in the same currencies, as the block the customer has
       just read. `withUsd` is what the screen renders with: quoted in the
       shipper's money with the naira beside it. The document is the page, on
       paper — not a second version of it computed another way. */
    /* The rate per kilo leads the block above and is not repeated here. */
    const perUnit = totalUnits > 1 ? [{ label: 'Rate per unit', value: withUsd(deliveryPart / totalUnits) }] : [];

    const charges = selected.base_price && selected.service_charge
      ? [
          ...perUnit,
          ...freightRows(),
          { label: chargeLabel(selected), value: withUsd(selected.service_charge) },
          { label: 'Total', value: withUsd(selected.price), strong: true },
        ]
      : [...perUnit, { label: 'Shipping cost', value: withUsd(selected.price), strong: true }];

    const opened = printShipmentSummary({
      reference: newShipmentInfo?.shipment_reference ?? null,
      /* The waybill if one was attached while booking — the note beside an AWB
         is where the number is written. */
      awbNumber: typedAwb || pendingDocs.find((d) => d.kind.toUpperCase() === 'AWB')?.note || null,
      /* The countries too, where they differ. "Benguela → Aba" reads as a
         domestic hop on a shipment crossing two borders, and the customs line
         at the foot only makes sense once the route says otherwise. */
      route: `${placeName(formData.pickup_address)} → ${placeName(formData.delivery_address)}`,
      service: serviceLabel(selected),
      eta: selected.estimated_delivery || selected.eta || null,
      pieces: totalUnits > 0 ? String(totalUnits) : null,
      rate: shipmentWeight > 0 ? withUsd(deliveryPart / shipmentWeight) : null,
      conversionNote: converts ? `Converted at ${formatMoney(1, baseCurrency)} = ${formatMoney(nairaPerBase, 'NGN')}` : null,
      weight: `${shipmentWeight.toFixed(2)} kg`,
      charges,
      pickup: place(formData.pickup_address),
      delivery: place(formData.delivery_address),
      items: formData.items
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          weight: `${parseFloat(i.weight) || 0} kg`,
          value: i.price ? formatMoney(parseFloat(i.price) || 0, 'NGN') : '—',
        })),
    });
    if (!opened) showError('Your browser blocked the download window. Allow pop-ups for this site and try again.');
  };

  const handleCreateShipment = async () => {
    if (!matchedRoute || !selected) {
      /* As above: a dead button with no explanation is worse than an error. */
      showError('This page has lost the price it was working from. Go back to Prices and pick one again — nothing you have typed is lost.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.createShipment({
        // The shipment belongs to the customer, not to the admin booking it.
        on_behalf_of: onBehalfOf,
        pickup_address: formData.pickup_address,
        delivery_address: deliveryAddress(),
        items: itemsPayload(),
        transport_mode: selected.transport_mode,
        service_level: selected.service_level,
        vendor_name: matchedRoute.external ? matchedRoute.carrier.name : 'obana.africa',
        carrier_slug: matchedRoute.external ? (matchedRoute.carrier.slug || 'external') : 'obana',
        external_shipment_id: matchedRoute.shipment_id,
        rate_id: matchedRoute.rate_id,
        /* Kept on the shipment, not only inside a document's note: the summary
           and the message that goes out both want it as a value. */
        awb_number: typedAwb || undefined,
        shipping_fee: selected.price,
        /* The split as it was shown. The server only takes it when the parts
           add up to the fee, and works it out itself otherwise. */
        base_price: selected.base_price,
        service_charge: selected.service_charge,
        service_charge_percent: selected.service_charge_percent,
        /* The two journeys, where this booking has two. Without them the
           shipment keeps the price but forgets it was ever split, and the
           document and the message show one freight line over a quote that
           showed two. The server checks they add up before trusting them. */
        legs: selected.legs,
        estimated_delivery: selected.estimated_delivery,
        preferred_driver_id: selected.preferred_driver?.id,
        // The server charges the quoted price only if this quote still holds for this booking.
        quote_reference: quoteRef || undefined,
        quote_option_id: quoteRef ? selected.id : undefined,
      });

      if (response.success && response.data) {
        clearPendingQuote();
        setNewShipmentInfo(response.data);
        setBooksResult((response as { invoice?: unknown }).invoice ?? null);
        setShowSuccessModal(true);
        setError('');
        /* The shipment is booked and shown before this starts: the papers are
           an addition to it, not a condition of it. */
        if (pendingDocs.length && response.data.shipment_id) {
          await attachPendingDocs(response.data.shipment_id);
        }
      } else {
        showError(response.message || "That shipment wasn't created. Please try again.");
      }
    } catch (err: any) {
      showError(
        err.response?.data?.message || "That shipment wasn't created — we couldn't reach the server. Check your connection and try again.",
        err.response?.data?.code || ''
      );
    } finally {
      setLoading(false);
    }
  };

  /* "10% service charge" when we know the rate, plain otherwise. */
  /* No percentage on it. What the customer owes is the amount; the percentage
     it was worked out from is our arithmetic, not their bill. */
  const chargeLabel = (_o: PriceOption) => 'Handling/Service Charge';

  /* The freight, as one line or as two.
  
     A parcel from Italy to Port Harcourt crosses a border and then travels on
     inside Nigeria — different jobs at different prices, and one line hides
     that. The crossing is named country to country, because which Italian city
     it left is not something the buyer chose; the home run is named city to
     city, because both ends are in the same country and naming it twice says
     nothing. One handling charge covers the two, since it is charged on the
     job and not on each leg. */
  const legLabel = (leg: NonNullable<PriceOption['legs']>[number]) => {
    const what = leg.kind === 'local' ? 'Last mile (local)' : 'International shipment';
    const where = [leg.from, leg.to].filter(Boolean).join(' → ');
    return where ? `${what} · ${where}` : what;
  };

  const freightRows = () =>
    selected?.legs && selected.legs.length > 1
      ? selected.legs.map((leg) => ({ label: legLabel(leg), value: withUsd(Number(leg.base_price) || 0) }))
      : [{ label: 'Total Freight Charge', value: withUsd(selected!.base_price!) }];

  const serviceLabel = (o: PriceOption) => o.carrier || `${o.transport_mode.charAt(0).toUpperCase()}${o.transport_mode.slice(1)} · ${o.service_level}`;

  return (
    <DashboardLayout role={role}>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>New shipment</h1>
            <p className="mt-1 text-slate-600">Add the addresses and items, pick a price, then confirm.</p>
            {customerPicker}
            {onBehalfOfName && (
              /* An admin can have several of these open at once, so the name
                 stays on screen rather than only in a dropdown. */
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1B3B5F]/[0.07] px-2.5 py-1 text-sm font-semibold text-[#1B3B5F]">
                Booking for {onBehalfOfName}
              </p>
            )}
          </div>
          <Link href={listHref} className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
        </div>

        {/* Progress: three equal columns so it always fits a phone */}
        <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
          {([['details', 'Details', Package], ['match', 'Price', Truck], ['confirm', 'Confirm', Check]] as const).map(([key, label, Icon], i) => {
            const current = ['details', 'match', 'confirm'].indexOf(step);
            const state = i < current ? 'done' : i === current ? 'current' : 'todo';
            return (
              <li key={key} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col gap-2">
                <span className={`h-1.5 rounded-full ${state === 'todo' ? 'bg-slate-200' : 'bg-[#1B3B5F]'}`} />
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${state === 'todo' ? 'text-slate-400' : 'text-[#1B3B5F]'}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{i + 1}. {label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {/* Error Modal */}
        {showErrorModal && error && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {/* A route we don't run is not a fault. Red is for things
                        that broke; this one is simply something we don't do
                        yet, and the sender has somewhere to go. */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${canContactUs ? 'bg-[#1B3B5F]/10' : 'bg-red-100'}`}>
                      {canContactUs ? (
                        <PackageSearch className="h-6 w-6 text-[#1B3B5F]" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {errorTitle}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {error}
                    </p>
                    {canContactUs && role !== 'admin' && (
                      <p className="mt-3 text-sm text-slate-500">
                        {supportPhoneDisplay()} · {SUPPORT_EMAIL}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={closeErrorModal}
                    aria-label="Close"
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* An admin can close the gap themselves; a customer needs a
                    person. Neither is served by a button saying "Continue". */}
                {canContactUs && role === 'admin' ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/dashboard/admin/routes"
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1B3B5F] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#16314e]"
                    >
                      Open routes
                    </Link>
                    <button
                      type="button"
                      onClick={closeErrorModal}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Back to the form
                    </button>
                  </div>
                ) : canContactUs ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={whatsappLink(askText())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1B3B5F] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#16314e]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp us
                    </a>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Shipment request: ${laneText()}`)}&body=${encodeURIComponent(askText())}`}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" aria-hidden /> Email us
                    </a>
                  </div>
                ) : (
                  <div className="mt-6 flex gap-3">
                    <Button onClick={closeErrorModal} fullWidth variant="primary">
                      Back to the form
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && newShipmentInfo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Shipment Created!</h2>
                <p className="text-gray-600 mt-2 mb-6">Your shipment has been created successfully.</p>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2 text-sm mb-6">
                  <p><span className="font-semibold">Tracking #:</span> {newShipmentInfo.shipment_reference}</p>
                  <p><span className="font-semibold">Carrier:</span> {newShipmentInfo.carrier}</p>
                  <p>
                    <span className="font-semibold">Status:</span>
                    <span className="capitalize ml-1">{newShipmentInfo.status}</span>
                  </p>
                  {/* What happened to the papers. Said here because the upload
                      runs after the shipment is already booked and shown. */}
                  {docStatus && (
                    <p className={docStatus.failed.length ? 'text-amber-700' : 'text-gray-700'}>
                      <span className="font-semibold">Documents:</span>{' '}
                      {docStatus.done < docStatus.total
                        ? `attaching ${docStatus.done + 1} of ${docStatus.total}…`
                        : docStatus.failed.length === 0
                          ? `${docStatus.total} attached`
                          : `${docStatus.total - docStatus.failed.length} of ${docStatus.total} attached — ${docStatus.failed.join(', ')} did not upload. Add it from the shipment page.`}
                    </p>
                  )}
                </div>

                {role === 'admin' && booksResult && (
                  <div className="mb-6 rounded-lg border p-3 text-left text-sm">
                    {(() => {
                      /* "Zoho accepted the request but returned no invoice" is
                         the server saying Zoho took the quote — it just could
                         not read the reference back out of the reply. Reading
                         that as "not sent" was wrong: the quote is in Books. */
                      const accepted = /accepted the request/i.test(String(booksResult.error ?? ''));
                      if (booksResult.invoice_number) {
                        return (
                          <p className="text-emerald-700">
                            <span className="font-semibold">Obana Books:</span> quote {booksResult.invoice_number} raised
                            {booksResult.amount ? ` (${booksResult.posted_in || 'USD'} ${booksResult.amount})` : ''}
                          </p>
                        );
                      }
                      if (accepted) {
                        return (
                          <p className="text-emerald-700">
                            <span className="font-semibold">Obana Books:</span> quote raised — Zoho did not return its
                            reference, so look it up under this shipment number.
                          </p>
                        );
                      }
                      return (
                        <p className="text-amber-700">
                          <span className="font-semibold">Not sent to Obana Books:</span>{' '}
                          {booksResult.skipped || booksResult.error || 'no reason given'}
                        </p>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={() => router.push(`${listHref}/${newShipmentInfo.shipment_reference}`)}
                    fullWidth
                    variant="primary"
                  >
                    Track Shipment
                  </Button>
                  <Button onClick={resetForm} fullWidth variant="secondary">
                    Create Another Shipment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {quote && (
          <div role="status" className="rounded-xl border border-[#1B3B5F]/15 bg-[#f1fdfc] px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Booking from quote {quote.reference}.</span>{' '}
            {quoteHolds
              ? `The route and weight are filled in, and the quoted price holds until ${new Date(quote.expires_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} for the same route and weight.`
              : "This quote has expired or was already used, so today's prices apply."}
          </div>
        )}

        {/* Step 1: Details */}
        {step === 'details' && (
          <Card>
            <div className="space-y-8">
              {/* Pick up where somebody left off. Only shown when there is
                  something to pick up — an empty list is one more thing to
                  read past on the way to a new booking. */}
              {drafts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="font-semibold text-gray-900 text-sm">Continue a saved booking</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {drafts.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => continueDraft(d)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          draftId === d.id ? 'border-amber-500 bg-white font-semibold' : 'border-amber-200 bg-white/70 hover:bg-white'
                        }`}
                      >
                        {d.label || 'Untitled draft'}
                        <span className="ml-2 text-gray-500 text-xs">
                          {new Date(d.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Pickup Location */}
              <div className="border-2 border-blue-100 rounded-xl p-6 bg-linear-to-br from-blue-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Pickup
                </h3>
                <p className="text-sm text-gray-600 mb-5">Where should we collect the package?</p>

                <div className="space-y-5">
                  <LocationInput
                    label="Location"
                    value={{
                      city: formData.pickup_address.city,
                      state: formData.pickup_address.state,
                      country: formData.pickup_address.country,
                      countryCode: formData.pickup_address.countryCode,
                      stateCode: formData.pickup_address.stateCode,
                    }}
                    onChange={(location) => setPickup(location)}
                    required
                    placeholder="Search for pickup city..."
                  />
                  {fieldErrors['pickup.location'] && <p data-invalid="true" className="-mt-3 text-sm text-rose-600">{fieldErrors['pickup.location']}</p>}

                  <Input
                    label="Street address"
                    error={fieldErrors['pickup.line1']}
                    placeholder="e.g., 12 Allen Avenue, Ikeja"
                    value={formData.pickup_address.line1}
                    onChange={(e) => setPickup({ line1: e.target.value })}
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Who should we ask for?"
                      placeholder="Optional"
                      value={formData.pickup_address.contact_name}
                      onChange={(e) => setPickup({ contact_name: e.target.value })}
                    />
                    <PhoneInput
                      key={`pickup-phone-${formData.pickup_address.countryCode || "NG"}`}
                      defaultCountry={(formData.pickup_address.countryCode || "NG").toLowerCase()}
                      label="Phone number"
                      error={fieldErrors['pickup.phone']}
                      value={formData.pickup_address.phone}
                      onChange={(phone) => setPickup({ phone })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Location */}
              <div className="border-2 border-green-100 rounded-xl p-6 bg-linear-to-br from-green-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Delivery
                </h3>
                <p className="text-sm text-gray-600 mb-5">Where should we deliver the package?</p>

                {/* The second leg, stated here because here is where somebody
                    knows it: the consignment clears somewhere, and then
                    travels on. Only on a shipment that crosses a border —
                    a domestic one has no crossing to separate from a last
                    mile. Blank means one journey, as now. */}
                {crossBorder && (
                  <div className="mb-5 rounded-lg border border-green-200 bg-white/70 p-4">
                    <p className="font-semibold text-gray-900 text-sm">Does it travel on inside {formData.delivery_address.country || 'the country'}?</p>
                    <p className="mb-3 text-gray-600 text-xs">
                      Choose the state it lands in. The stretch from there to the delivery state is priced from your
                      domestic routes and charged as its own leg, on its own line — so the total is the international
                      price, plus that leg, plus one handling charge. Leave it blank and the shipment is quoted as one
                      journey, as now.
                    </p>
                    {/* Two lists, not two text boxes. The leg is priced by
                        matching a route between two states, and a state typed
                        by hand does not match one — "Port Harcourt" in a state
                        field found no route and the leg was silently never
                        priced. Both ends are chosen, so both always match. */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        label="Lands in (state)"
                        placeholder="Select a state…"
                        value={formData.arrival.state}
                        options={NIGERIAN_STATES}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setFormData((prev) => ({ ...prev, arrival: { ...prev.arrival, state: e.target.value } }))
                        }
                      />
                      <Select
                        label="Delivers to (state)"
                        placeholder="Select a state…"
                        value={formData.delivery_address.state}
                        options={NIGERIAN_STATES}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          /* The destination state itself, so the two ends of
                             the home run cannot disagree with the address the
                             parcel is going to. */
                          setDelivery({ ...formData.delivery_address, state: e.target.value, stateCode: '' })
                        }
                      />
                    </div>
                  </div>
                )}


                {/* Somebody this account has sent to before. The delivery
                    address on a past shipment is the only record that is
                    certainly right — it was typed, checked and delivered
                    against — so it is the one worth offering back. */}
                {customers.length > 0 && (
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={() => setShowCustomers((v) => !v)}
                      className="rounded-lg border border-green-300 bg-white px-3 py-1.5 font-medium text-green-800 text-sm hover:bg-green-50"
                    >
                      {showCustomers ? 'Hide previous customers' : 'Use a previous customer'}
                    </button>
                    {showCustomers && (
                      <ul className="mt-2 max-h-56 divide-y overflow-y-auto rounded-lg border bg-white">
                        {customers.map((c, i) => (
                          <li key={`${c.phone}-${i}`}>
                            <button
                              type="button"
                              onClick={() => useCustomer(c)}
                              className="w-full px-3 py-2 text-left hover:bg-green-50"
                            >
                              <span className="block font-medium text-gray-900 text-sm">{c.name || c.phone}</span>
                              <span className="block text-gray-500 text-xs">
                                {[c.phone, [c.city, c.state].filter(Boolean).join(', '), c.country].filter(Boolean).join(' · ')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="space-y-5">
                  <LocationInput
                    label="Location"
                    value={{
                      city: formData.delivery_address.city,
                      state: formData.delivery_address.state,
                      country: formData.delivery_address.country,
                      countryCode: formData.delivery_address.countryCode,
                      stateCode: formData.delivery_address.stateCode,
                    }}
                    onChange={(location) => setDelivery(location)}
                    required
                    placeholder="Search for delivery city..."
                  />
                  {fieldErrors['delivery.location'] && <p data-invalid="true" className="-mt-3 text-sm text-rose-600">{fieldErrors['delivery.location']}</p>}

                  <Input
                    label="Street address"
                    error={fieldErrors['delivery.line1']}
                    placeholder="e.g., 5 Adeola Odeku Street, Victoria Island"
                    value={formData.delivery_address.line1}
                    onChange={(e) => setDelivery({ line1: e.target.value })}
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Recipient name"
                      error={fieldErrors['delivery.name']}
                      placeholder="e.g., Ada Obi"
                      value={formData.delivery_address.name}
                      onChange={(e) => setDelivery({ name: e.target.value })}
                      required
                    />
                    <PhoneInput
                      key={`delivery-phone-${formData.delivery_address.countryCode || "NG"}`}
                      defaultCountry={(formData.delivery_address.countryCode || "NG").toLowerCase()}
                      label="Recipient phone"
                      error={fieldErrors['delivery.phone']}
                      value={formData.delivery_address.phone}
                      onChange={(phone) => setDelivery({ phone })}
                      required
                    />
                  </div>

                  <Input
                    label="Recipient email (optional)"
                    error={fieldErrors['delivery.email']}
                    type="email"
                    placeholder="For delivery updates"
                    value={formData.delivery_address.email}
                    onChange={(e) => setDelivery({ email: e.target.value })}
                  />
                </div>
              </div>

              {/* Package Items */}
              <div className="border-2 border-purple-100 rounded-xl p-6 bg-linear-to-br from-purple-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  What you&apos;re sending
                </h3>
                <p className="text-sm text-gray-600 mb-5">Weight sets the price, so give us the packed weight if you can. Value is optional — it is what we cover if the parcel goes missing.</p>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-white p-5 rounded-lg border-2 border-purple-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-purple-900">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <Button
                            onClick={() => setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))}
                            variant="secondary"
                            className="py-1! px-3! text-sm bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <Input
                        label="What are you sending?"
                        error={fieldErrors[`item.${index}.name`]}
                        placeholder="e.g., Laptop and charger"
                        value={item.name}
                        onChange={(e) => setItem(index, { name: e.target.value })}
                        required
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="How heavy is it altogether? (kg)"
                          error={fieldErrors[`item.${index}.weight`]}
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g., 2.5"
                          value={item.weight}
                          onChange={(e) => setItem(index, { weight: e.target.value })}
                          required
                        />
                        <Input
                          label="What is it worth? (₦, optional)"
                          error={fieldErrors[`item.${index}.price`]}
                          type="number"
                          step="0.01"
                          placeholder="Leave blank if you'd rather not say"
                          value={item.price}
                          onChange={(e) => setItem(index, { price: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))}
                  variant="secondary"
                  fullWidth
                  className="mt-4 border-2 border-purple-300 hover:bg-purple-50"
                >
                  + Add something else
                </Button>
              </div>

              <DocumentPicker value={pendingDocs} onChange={setPendingDocs} onAwbTyped={setTypedAwb} disabled={loading} />

              {errorCount > 0 && (
                <Alert type="error">
                  {errorCount === 1 ? '1 detail needs' : `${errorCount} details need`} your attention — check the highlighted fields above.
                </Alert>
              )}
              <Button
                onClick={handleMatchRoute}
                loading={loading}
                fullWidth
                variant="primary"
                className="py-4! text-lg font-semibold"
              >
                See prices →
              </Button>
              {/* Keep what has been typed without finishing. Deliberately not
                  validated: a draft is a half-filled form, and refusing to
                  save one until it is complete defeats the point of it. */}
              <button
                type="button"
                onClick={saveDraft}
                disabled={draftState === 'saving'}
                className="w-full rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
              >
                {draftState === 'saving' ? 'Saving…' : draftState === 'saved' ? 'Saved — you can come back to this' : 'Save as draft'}
              </button>
            </div>
          </Card>
        )}

        {/* Step 2: Pick a price */}
        {step === 'match' && selected && (
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Choose a price</h2>
              <p className="text-gray-600 mt-1">
                {formData.pickup_address.city}, {formData.pickup_address.state} → {formData.delivery_address.city}, {formData.delivery_address.state} · {shipmentWeight.toFixed(2)} kg
              </p>
            </div>

            <div className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="sr-only">Delivery options</legend>
                {priceOptions.map((o, i) => {
                  const active = o.id === selected.id;
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer flex-col items-start gap-3 rounded-xl border-2 bg-white p-4 transition sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${active ? 'border-[#1B3B5F] shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <input
                          type="radio"
                          name="price-option"
                          className="h-4 w-4 shrink-0 accent-[#1B3B5F]"
                          checked={active}
                          onChange={() => setSelectedOptionId(o.id)}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                            {serviceLabel(o)}
                            {i === 0 && priceOptions.length > 1 && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Cheapest</span>
                            )}
                            {o.held && (
                              <span className="rounded-full bg-[#dcfbf9] px-2 py-0.5 text-xs font-semibold text-[#1B3B5F]">Quoted price</span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                            <Clock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                            {o.estimated_delivery || o.eta || 'Delivery date confirmed after booking'}
                          </span>
                        </span>
                      </span>
                      {/* The price, and what it is made of. On a phone this sits
                          under the service rather than beside it, so neither
                          number has to shrink to fit. */}
                      <span className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                        <span className="block text-lg font-bold tabular-nums text-gray-900">{formatMoney(o.price, 'NGN')}</span>
                        {/* Two journeys are shown as two, here as well as on
                            the invoice: this is the screen where the price is
                            being chosen, and a single figure hides which half
                            of the trip costs what. */}
                        {o.legs && o.legs.length > 1 ? (
                          <span className="mt-1 block space-y-0.5 text-xs text-gray-500 tabular-nums">
                            {o.legs.map((leg, li) => (
                              <span key={li} className="block">
                                {leg.kind === 'local' ? 'Last mile' : 'International'} {[leg.from, leg.to].filter(Boolean).join(' → ')}
                                {' — '}
                                {formatMoney(Number(leg.base_price) || 0, 'NGN')}
                              </span>
                            ))}
                            {!!o.service_charge && (
                              <span className="block">+ {formatMoney(o.service_charge, 'NGN')} {chargeLabel(o)}</span>
                            )}
                          </span>
                        ) : (
                          !!o.service_charge && !!o.base_price && (
                            <span className="mt-0.5 block text-xs text-gray-500 tabular-nums">
                              {formatMoney(o.base_price, 'NGN')} delivery + {formatMoney(o.service_charge, 'NGN')} {chargeLabel(o)}
                            </span>
                          )
                        )}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {selected.preferred_driver && !matchedRoute.external && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="bg-white p-2 rounded-full shadow-sm">
                    <Truck className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Fast-Track Assignment</p>
                    <p className="text-sm text-gray-900">
                      <span className="font-bold">{selected.preferred_driver.driver_code}</span> is ready for this route
                      <span className="text-gray-500 ml-1">({selected.preferred_driver.vehicle_type})</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Button onClick={() => setStep('confirm')} fullWidth variant="primary" className="py-3!">
                  Continue with {formatMoney(selected.price, 'NGN')}
                </Button>
                <Button onClick={() => setStep('details')} fullWidth variant="secondary">
                  ← Back to Details
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && selected && (
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
              <p className="text-gray-600 mt-1">Please review your shipment details</p>
            </div>

            <div className="space-y-5">
              {/* Shipment Summary */}
              <div className="bg-linear-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Shipment Summary
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-gray-600">Route</p>
                    {/* Two journeys are named as two. One line reading
                        "Villaverla → Port Harcourt" over a consignment that
                        clears in Ikeja and travels on inland says nothing
                        about the second half — which is the half charged for
                        separately below.

                        The countries are on the crossing, because "Alberton →
                        Aba" reads as a domestic hop on a shipment that crosses
                        two borders, and the customs line at the foot of the
                        summary only makes sense once the route says so. */}
                    {selected?.legs && selected.legs.length > 1 ? (
                      <div className="font-semibold text-gray-900">
                        {selected.legs.map((leg, li) => (
                          <span key={li} className="block">
                            <span className="mr-1 font-normal text-gray-500 text-xs">
                              {leg.kind === 'local' ? 'Last mile' : 'International'}
                            </span>
                            {[leg.from, leg.to].filter(Boolean).join(' → ')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="font-semibold text-gray-900">
                        {placeName(formData.pickup_address)} → {placeName(formData.delivery_address)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600">Service</p>
                    <p className="font-semibold text-gray-900">{serviceLabel(selected)}</p>
                  </div>
                  {/* How long it takes, where it is being agreed to. It was on
                      the price step and then vanished at the point of
                      confirming, which is the one moment it matters. */}
                  <div>
                    <p className="text-gray-600">Estimated arrival</p>
                    <p className="font-semibold text-gray-900">
                      {selected.estimated_delivery || selected.eta || 'Confirmed after booking'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total weight</p>
                    <p className="font-semibold text-gray-900">{shipmentWeight.toFixed(2)} kg</p>
                  </div>
                  {/* The rate, not the total. The total is the last line of the
                      breakdown immediately below, where a total belongs; what
                      somebody wants at the top is the figure they can hold
                      against another forwarder's quote. */}
                  <div>
                    <p className="text-gray-600">Shipping rate / kilo</p>
                    <p className="font-bold text-green-600 text-lg">
                      {shipmentWeight > 0 && selected.base_price
                        ? withUsd(selected.base_price / shipmentWeight)
                        : withUsd(selected.price)}
                    </p>
                  </div>
                </div>

                {/* What that total is made of, where somebody is about to agree
                    to it. The charge is a line on Obana's own quotes and on the
                    Books estimate; it should not be the one place it is hidden. */}
                {!!selected.service_charge && !!selected.base_price && (
                  <dl className="mt-4 space-y-1.5 border-t border-blue-200/70 pt-4 text-sm">
                    {/* The rate per kilo is not repeated here — it leads the
                        block above, and the same figure twice on one card reads
                        as two different charges.

                        Per unit stays, only where there is more than one: on a
                        single item it repeats the freight line below it. */}
                    {totalUnits > 1 && (
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-gray-600">Rate per unit</dt>
                        <dd className="font-medium text-gray-900 tabular-nums">{withUsd(selected.base_price! / totalUnits)}</dd>
                      </div>
                    )}
                    {freightRows().map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-4">
                        <dt className="text-gray-600">{row.label}</dt>
                        <dd className="font-medium text-gray-900 tabular-nums">{row.value}</dd>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-gray-600">{chargeLabel(selected)}</dt>
                      <dd className="font-medium text-gray-900 tabular-nums">{withUsd(selected.service_charge!)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 border-t border-blue-200/70 pt-1.5">
                      <dt className="font-semibold text-gray-900">Total</dt>
                      <dd className="font-bold text-gray-900 tabular-nums">{withUsd(selected.price)}</dd>
                    </div>
                    {/* The rate it was converted at. Two currencies with no
                        rate between them is a number nobody can check, and
                        checking it is the point of showing theirs. */}
                    {converts && (
                      <p className="pt-1 text-xs text-gray-500">
                        Converted at {formatMoney(1, baseCurrency)} = {formatMoney(nairaPerBase, 'NGN')}
                      </p>
                    )}
                  </dl>
                )}
              </div>

              {/* Addresses */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-blue-50/30">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Pickup Address
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700">
                    {formData.pickup_address.contact_name && <p className="font-medium">{formData.pickup_address.contact_name}</p>}
                    <p>{formData.pickup_address.line1}</p>
                    <p>{formData.pickup_address.city}, {formData.pickup_address.state}</p>
                    <p>{formData.pickup_address.country}</p>
                    <p className="pt-1 font-medium">{showPhone(formData.pickup_address.phone)}</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-green-50/30">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    Delivery Address
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700">
                    <p className="font-medium">{formData.delivery_address.name}</p>
                    <p>{formData.delivery_address.line1}</p>
                    <p>{formData.delivery_address.city}, {formData.delivery_address.state}</p>
                    <p>{formData.delivery_address.country}</p>
                    <p className="pt-1 font-medium">{showPhone(formData.delivery_address.phone)}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="border border-gray-200 rounded-lg p-5 bg-purple-50/30">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  Items ({formData.items.length})
                </h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-3 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500 mt-1">{item.weight} kg each</p>
                      </div>
                      <div className="text-right text-sm ml-4">
                        <p className="font-semibold text-gray-900">{item.weight} kg</p>
                        {/* Blank rather than ₦0.00: an unstated value is not a
                            worthless parcel. */}
                        {parseFloat(item.price) > 0 && (
                          <p className="text-gray-600 mt-1">{formatMoney(parseFloat(item.price), 'NGN')} each</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleCreateShipment}
                  loading={loading}
                  fullWidth
                  variant="primary"
                  className="py-4! text-lg font-semibold"
                >
                  ✓ Confirm & Create Shipment
                </Button>
                <button
                  type="button"
                  onClick={downloadSummary}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-slate-300 px-4 py-3 font-semibold text-slate-700 text-sm transition-colors hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download summary (PDF)
                </button>
                <Button onClick={() => setStep('match')} fullWidth variant="secondary">
                  ← Back to Prices
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
