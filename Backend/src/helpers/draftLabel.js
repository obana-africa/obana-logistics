/**
 * What a draft is called in the list.
 *
 * "Lagos → Abuja" was the whole of it, which is a journey and not a
 * shipment: three drafts on the same lane came out with the same name, so a
 * list of them was a list of identical rows and the only way to tell them
 * apart was to open each one. The recipient and the weight are what actually
 * differ between two bookings down the same lane, so they are in the name.
 *
 * Still just whatever exists — a draft is a half-filled form and most of
 * this is routinely blank.
 */
const labelFor = (form, given) => {
    const named = String(given ?? '').trim();
    if (named) return named.slice(0, 120);

    const where = (a) => String(a?.city || a?.state || '').trim();
    const from = where(form?.pickup_address);
    const to = where(form?.delivery_address);
    const journey = from && to ? `${from} → ${to}` : from || to || '';

    const who = String(form?.delivery_address?.name ?? '').trim();

    const kilos = (Array.isArray(form?.items) ? form.items : []).reduce((sum, item) => {
        const weight = Number(String(item?.weight ?? '').trim());
        const qty = Number(String(item?.quantity ?? '1').trim()) || 1;
        return Number.isFinite(weight) && weight > 0 ? sum + weight * qty : sum;
    }, 0);
    const load = kilos > 0 ? `${Number(kilos.toFixed(2))} kg` : '';

    const parts = [journey, who, load].filter(Boolean);
    return parts.length ? parts.join(' · ').slice(0, 120) : 'Untitled draft';
};

module.exports = { labelFor };
