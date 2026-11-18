/**
 * What the 2026 reprice would do, before it does it.
 *
 * Read-only. Prints every route whose parcel price or ETA would move, old to
 * new, grouped by lane, with the quoted figure (base + the 10% service
 * charge) because that is the number a customer sees and the one worth
 * checking against a competitor's website.
 *
 *   API=https://obana-logistics-t6qg.onrender.com \
 *   TOKEN=<admin jwt> \
 *   node scripts/preview-nigeria-prices.js
 *
 * Reads GET /routes, the same list the admin dashboard shows, so it needs an
 * admin login and no database credentials.
 */

const { repriceTable } = require('../src/seeds/repriceNigeria');
const { tierFor } = require('../src/seeds/pricing2026');

const API = (process.env.API || 'https://obana-logistics-t6qg.onrender.com').replace(/\/+$/, '');
const TOKEN = process.env.TOKEN || '';

/** What the customer is quoted: the base plus the lane's service charge. */
const quoted = (base, percent) => Math.ceil(Number(base) * (1 + Number(percent ?? 10) / 100));
const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

const TIER_NAME = {
    same: 'within one state',
    0: 'same zone',
    1: 'neighbouring zones',
    2: 'across the south',
    3: 'south to the far north',
};

async function main() {
    if (!TOKEN) {
        console.error('Set TOKEN to an admin JWT. See the comment at the top of this file.');
        process.exit(1);
    }

    const res = await fetch(`${API}/routes`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
        console.error(`GET /routes failed: ${res.status} ${res.statusText}`);
        process.exit(1);
    }
    const rows = (await res.json())?.data;
    if (!Array.isArray(rows) || !rows.length) {
        console.error('No routes came back. Check the token and the API URL.');
        process.exit(1);
    }

    const before = new Map(rows.map((r) => [r.id, r]));
    const { edits, skipped } = repriceTable(rows);

    console.log(`${rows.length} routes read.\n`);

    if (!edits.length) {
        console.log('Every Nigerian lane is already on the 2026 prices.');
    } else {
        /* Grouped by lane, because a price only means something beside the
           other services on the same route. */
        const byLane = new Map();
        for (const edit of edits) {
            const key = `${edit.lane.from} → ${edit.lane.to}`;
            if (!byLane.has(key)) byLane.set(key, []);
            byLane.get(key).push(edit);
        }

        console.log(`${edits.length} routes across ${byLane.size} lanes would move:\n`);
        for (const [lane, members] of [...byLane].sort()) {
            const tier = TIER_NAME[tierFor(members[0].lane)] ?? '';
            console.log(`  ${lane}${tier ? `  (${tier})` : ''}`);
            for (const edit of members) {
                const row = before.get(edit.id);
                const percent = row.metadata?.service_charge_percent;
                for (const after of edit.brackets) {
                    const was = (row.weight_brackets || []).find(
                        (b) => Number(b.min ?? 0) === Number(after.min ?? 0) && Number(b.max ?? 0) === Number(after.max ?? 0)
                    );
                    if (!was || (Number(was.price) === Number(after.price) && was.eta === after.eta)) continue;
                    console.log(
                        `    ${String(row.transport_mode).padEnd(5)} ${String(row.service_level).padEnd(9)}` +
                            ` ${naira(quoted(was.price, percent)).padStart(10)} → ${naira(quoted(after.price, percent)).padStart(10)}` +
                            `   ${String(was.eta ?? '—').padEnd(10)} → ${after.eta}`
                    );
                }
            }
            console.log('');
        }
        console.log('Prices shown are what a customer is quoted: the base plus the lane\'s service charge.\n');
    }

    if (skipped.length) {
        console.log(`${skipped.length} routes left alone (international, or a service this tier does not sell).`);
        const reasons = new Map();
        for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
        for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${String(n).padStart(4)}  ${reason}`);
        }
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
