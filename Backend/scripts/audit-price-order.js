/**
 * Show every lane where a faster service is priced below a slower one.
 *
 * Read-only. This is what migration 20261116120000-price-follows-speed would
 * change, printed before it changes anything, so the repricing can be checked
 * by eye against Routes & pricing first.
 *
 *   API=https://obana-logistics-t6qg.onrender.com \
 *   TOKEN=<admin jwt> \
 *   node scripts/audit-price-order.js
 *
 * It reads GET /routes, the same list the admin dashboard shows, so it needs
 * an admin login and no database credentials.
 */

const { orderTableBySpeed, laneKeyOf, bandKeyOf } = require('../src/seeds/priceOrder');

const API = (process.env.API || 'https://obana-logistics-t6qg.onrender.com').replace(/\/+$/, '');
const TOKEN = process.env.TOKEN || '';

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

async function main() {
    if (!TOKEN) {
        console.error('Set TOKEN to an admin JWT. See the comment at the top of this file.');
        process.exit(1);
    }

    /* GET /routes returns the whole table — responseSuccess wraps it as
       { status, data: [...] } with no paging. */
    const res = await fetch(`${API}/routes`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
        console.error(`GET /routes failed: ${res.status} ${res.statusText}`);
        process.exit(1);
    }
    const body = await res.json();
    const rows = body?.data;
    if (!Array.isArray(rows) || !rows.length) {
        console.error('No routes came back. Check the token and the API URL.');
        process.exit(1);
    }

    const before = new Map(rows.map((r) => [r.id, r]));
    const { edits, skipped, lanes } = orderTableBySpeed(rows);

    console.log(`${rows.length} routes, ${lanes} lanes.\n`);

    if (!edits.length) {
        console.log('Every lane already prices the faster service higher. Nothing to change.');
    } else {
        /* Grouped by lane, because a swap only makes sense read as a pair. */
        const byLane = new Map();
        for (const edit of edits) {
            const row = before.get(edit.id);
            const key = laneKeyOf(row);
            if (!byLane.has(key)) byLane.set(key, []);
            byLane.get(key).push({ row, brackets: edit.brackets });
        }

        console.log(`Would reorder ${edits.length} routes across ${byLane.size} lanes:\n`);
        for (const [lane, members] of byLane) {
            console.log(`  ${lane}`);
            for (const { row, brackets } of members) {
                for (const after of brackets) {
                    const was = (row.weight_brackets || []).find((b) => bandKeyOf(b) === bandKeyOf(after));
                    if (!was || Number(was.price) === Number(after.price)) continue;
                    console.log(
                        `    ${String(row.service_level).padEnd(9)} ${String(after.eta ?? '').padEnd(10)}` +
                            ` ${bandKeyOf(after).padEnd(9)} ${naira(was.price)} → ${naira(after.price)}`,
                    );
                }
            }
            console.log('');
        }
    }

    if (skipped.length) {
        console.log(`\n${skipped.length} band(s) left alone — these need a person, not a swap:\n`);
        for (const s of skipped) console.log(`  ${s.lane} band ${s.band}: ${s.reason}`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
