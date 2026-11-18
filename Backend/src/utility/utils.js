const axios  = require('axios')
const querystring = require('node:querystring');

/**
 * Exchange a refresh token for an access token.
 *
 * This used to end in `.catch(error => { console.error(...) })`, which logged
 * and returned undefined — so a refusal from Zoho left the caller holding
 * nothing and no idea why. Thrown now, with what Zoho actually said, because
 * every caller of this needs the token and none of them can do their job
 * without it.
 */
async function refreshToken(refreshTokenCredentials) {
    if (!process.env.ZOHO_AUTH_URL) {
        throw new Error('ZOHO_AUTH_URL is not set')
    }
    try {
        return await axios.post(
            process.env.ZOHO_AUTH_URL,
            querystring.stringify(refreshTokenCredentials)
        )
    } catch (error) {
        /* Zoho answers a dead or revoked refresh token with 200 and an error
           body as often as it does with a 4xx, so the message matters more
           than the status. */
        const said = error?.response?.data
            ? JSON.stringify(error.response.data)
            : error.message
        throw new Error(`Zoho token refresh failed: ${said}`)
    }
}

function tokenCredentials(reToken) {
    return {
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: reToken
        }
    }

/**
 * An Authorization header for Zoho Inventory.
 *
 * It used to return the STRING "Zoho-oauthtoken undefined" when the refresh
 * failed. That is a syntactically valid header, so nothing noticed: every
 * Zoho call made with it came back 401, each caller caught its own 401 and
 * carried on with empty data, and a sales order ended up producing no
 * shipment while Zoho's workflow log showed Success in green.
 *
 * A credential that cannot be obtained is an error, and it names the setting
 * to go and look at — an expired or revoked INVENTORY_REFRESH_TOKEN is the
 * usual cause, and it fails this way months after anyone last touched it.
 */
async function getZohoInventoryToken() {
    const missing = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'INVENTORY_REFRESH_TOKEN']
        .filter((key) => !process.env[key])
    if (missing.length) {
        throw new Error(`Zoho Inventory is not configured: ${missing.join(', ')} not set`)
    }

    const data = (await refreshToken(tokenCredentials(process.env.INVENTORY_REFRESH_TOKEN)))?.data

    if (!data?.access_token) {
        const said = data ? JSON.stringify(data) : 'no response body'
        throw new Error(
            `Zoho returned no access token — INVENTORY_REFRESH_TOKEN is expired or revoked. Zoho said: ${said}`
        )
    }

    return 'Zoho-oauthtoken ' + data.access_token
}

module.exports = {
    getZohoInventoryToken
}
