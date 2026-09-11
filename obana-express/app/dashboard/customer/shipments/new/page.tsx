/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useSyncExternalStore } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Alert, Card, Button, Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { formatMoney } from '@/lib/shipments';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Package, MapPin, Truck, Clock, AlertCircle, X } from 'lucide-react';
import { LocationInput } from '@/components/LocationInput';
import PhoneInput from '@/components/PhoneInput';

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
const emptyItem = () => ({ name: '', quantity: '1', weight: '', price: '' });
const emptyForm = () => ({
  pickup_address: { line1: '', city: '', state: '', country: '', countryCode: '', stateCode: '', phone: '', contact_name: '' },
  delivery_address: { line1: '', city: '', state: '', country: '', countryCode: '', stateCode: '', phone: '', name: '', email: '' },
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
  eta?: string | null;
  estimated_delivery?: string | null;
  preferred_driver?: { id: number | string; driver_code?: string; vehicle_type?: string } | null;
  carrier?: string;
};

const splitName = (full: string) => {
  const [first_name = '', ...rest] = full.trim().split(/\s+/);
  return { first_name, last_name: rest.join(' ') };
};

export default function CreateShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newShipmentInfo, setNewShipmentInfo] = useState<any>(null);
  const [matchedRoute, setMatchedRoute] = useState<any>(null);
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

  const setPickup = (patch: Partial<Form['pickup_address']>) =>
    setFormData((prev) => ({ ...prev, pickup_address: { ...prev.pickup_address, ...patch } }));
  const setDelivery = (patch: Partial<Form['delivery_address']>) =>
    setFormData((prev) => ({ ...prev, delivery_address: { ...prev.delivery_address, ...patch } }));
  const setItem = (index: number, patch: Partial<Item>) =>
    setFormData((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  // Weight is per unit, so multiply by quantity.
  const shipmentWeight = formData.items.reduce(
    (sum, item) => sum + (parseFloat(item.weight) || 0.5) * (parseInt(item.quantity) || 1),
    0
  );

  // Every service the server priced for this route, cheapest first. A partner rate (or a lone route price) is one option.
  const crossBorder = formData.pickup_address.countryCode !== formData.delivery_address.countryCode;
  const priceOptions: PriceOption[] = !matchedRoute
    ? []
    : matchedRoute.options?.length
      ? matchedRoute.options
      : [{
          id: 'only',
          transport_mode: matchedRoute.service?.transport_mode || (crossBorder ? 'air' : 'road'),
          service_level: matchedRoute.service?.service_level || 'Standard',
          price: Number(matchedRoute.match?.price),
          eta: matchedRoute.match?.eta,
          estimated_delivery: matchedRoute.match?.estimated_delivery,
          preferred_driver: matchedRoute.external ? null : matchedRoute.preferred_driver,
          carrier: matchedRoute.external ? matchedRoute.carrier?.name : undefined,
        }];
  const selected = priceOptions.find((o) => o.id === selectedOptionId) ?? priceOptions[0];

  const deliveryAddress = () => {
    const { name, ...rest } = formData.delivery_address;
    return { ...rest, ...splitName(name) };
  };
  const itemsPayload = () =>
    formData.items.map((item) => ({
      name: item.name.trim(),
      quantity: parseInt(item.quantity) || 1,
      weight: parseFloat(item.weight) || 0.5,
      price: parseFloat(item.price),
      total_price: parseFloat(item.price),
    }));

  const showError = (message: string) => {
    setError(message);
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
      if (!(parseInt(item.quantity) >= 1)) e[`item.${i}.quantity`] = 'At least 1.';
      if (!(parseFloat(item.price) > 0)) e[`item.${i}.price`] = 'Enter the item value.';
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
        showError("We don't deliver on this route yet. Contact us and we'll look for a way to move it.");
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error getting prices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!matchedRoute || !selected) return;

    setLoading(true);
    try {
      const response = await apiClient.createShipment({
        pickup_address: formData.pickup_address,
        delivery_address: deliveryAddress(),
        items: itemsPayload(),
        transport_mode: selected.transport_mode,
        service_level: selected.service_level,
        vendor_name: matchedRoute.external ? matchedRoute.carrier.name : 'obana.africa',
        carrier_slug: matchedRoute.external ? (matchedRoute.carrier.slug || 'external') : 'obana',
        external_shipment_id: matchedRoute.shipment_id,
        rate_id: matchedRoute.rate_id,
        shipping_fee: selected.price,
        estimated_delivery: selected.estimated_delivery,
        preferred_driver_id: selected.preferred_driver?.id
      });

      if (response.success && response.data) {
        setNewShipmentInfo(response.data);
        setShowSuccessModal(true);
        setError('');
      } else {
        showError(response.message || 'Error creating shipment. Please try again.');
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error creating shipment. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const serviceLabel = (o: PriceOption) => o.carrier || `${o.transport_mode.charAt(0).toUpperCase()}${o.transport_mode.slice(1)} · ${o.service_level}`;

  return (
    <DashboardLayout role="customer">
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>New shipment</h1>
            <p className="mt-1 text-slate-600">Add the addresses and items, pick a price, then confirm.</p>
          </div>
          <Link href="/dashboard/customer/shipments" className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
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
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Oops! Something went wrong
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {error}
                    </p>
                  </div>
                  <button
                    onClick={closeErrorModal}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button
                    onClick={closeErrorModal}
                    fullWidth
                    variant="primary"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Continue
                  </Button>
                </div>
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
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => router.push(`/dashboard/customer/shipments/${newShipmentInfo.shipment_reference}`)}
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

        {/* Step 1: Details */}
        {step === 'details' && (
          <Card>
            <div className="space-y-8">
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
                      label="Contact name (optional)"
                      placeholder="Who we ask for"
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
                <p className="text-sm text-gray-600 mb-5">Weight sets the price, so weigh the packed item if you can.</p>

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

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Item name"
                          error={fieldErrors[`item.${index}.name`]}
                          placeholder="e.g., Laptop"
                          value={item.name}
                          onChange={(e) => setItem(index, { name: e.target.value })}
                          required
                        />
                        <Input
                          label="Quantity"
                          error={fieldErrors[`item.${index}.quantity`]}
                          type="number"
                          min="1"
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => setItem(index, { quantity: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Weight per item (kg)"
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
                          label="Value per item (₦)"
                          error={fieldErrors[`item.${index}.price`]}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) => setItem(index, { price: e.target.value })}
                          required
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
                  + Add Another Item
                </Button>
              </div>

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
                      className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 bg-white p-4 transition ${active ? 'border-[#1B3B5F] shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
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
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                            <Clock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                            {o.estimated_delivery || o.eta || 'Delivery date confirmed after booking'}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-lg font-bold tabular-nums text-gray-900">{formatMoney(o.price, 'NGN')}</span>
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
                    <p className="font-semibold text-gray-900">
                      {formData.pickup_address.city} → {formData.delivery_address.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Service</p>
                    <p className="font-semibold text-gray-900">{serviceLabel(selected)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total weight</p>
                    <p className="font-semibold text-gray-900">{shipmentWeight.toFixed(2)} kg</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Shipping Cost</p>
                    <p className="font-bold text-green-600 text-lg">{formatMoney(selected.price, 'NGN')}</p>
                  </div>
                </div>
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
                    <p className="pt-1 font-medium">{formData.pickup_address.phone}</p>
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
                    <p className="pt-1 font-medium">{formData.delivery_address.phone}</p>
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
                        <p className="font-semibold text-gray-900">Qty: {item.quantity}</p>
                        <p className="text-gray-600 mt-1">{formatMoney(parseFloat(item.price || '0'), 'NGN')} each</p>
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
