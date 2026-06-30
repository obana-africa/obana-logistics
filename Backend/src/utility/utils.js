const axios  = require('axios')
const querystring = require('node:querystring');

async function refreshToken(refreshTokenCredentials) {
            let token = await axios.post(process.env.ZOHO_AUTH_URL, querystring.stringify(refreshTokenCredentials))
                .catch(error => {
                    console.error('Error fetching data', error);
                });
    
            return token;
    }

function tokenCredentials(reToken) {
    return {
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: reToken
        }
    }

async function getZohoInventoryToken() {
        
        let zohoInventoryToken;
            let zohoInventoryTokenData = (await refreshToken(tokenCredentials(process.env.INVENTORY_REFRESH_TOKEN)))?.data;

            if (zohoInventoryTokenData?.access_token) {
                zohoInventoryToken = zohoInventoryTokenData.access_token
            }
        return 'Zoho-oauthtoken ' + zohoInventoryToken;
    }

module.exports = {
    getZohoInventoryToken
}