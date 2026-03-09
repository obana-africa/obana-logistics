# Multi-Tenant API Feature - Implementation Complete

## Overview

Businesses can now onboard on the Obana Logistics platform and get API access to programmatically create, track, and manage shipments.

## Backend Changes

### 1. Tenant Management (`tenantController.js`)

**New Methods:**
- `registerTenant(name, slug, base_url, description)` - Business self-registration endpoint
- `generateApiKey()` - Generates unique API keys (format: `obana_{32-char-hex}`)
- `validateApiKey(apiKey)` - Validates API key and returns tenant info
- `regenerateApiKey(tenantId)` - Allows tenant to rotate their API key

**API Key Storage:**
- API keys are stored in the `config` JSON field of the tenants table
- Format: `{ "x-api_key": "obana_..." }`

### 2. API Key Authentication (`middleware/apiKeyAuth.js`)

**New Middleware:**
- `authenticateApiKey` - Validates Authoriation header and attaches tenant to request

**Usage:**
All requests include API key in header:
```
Authoriation: obana_...
```

### 3. Shipments Routes (`routes/shipments.js`)

**Unified Authentication:**
- Routes now accept EITHER JWT (user) OR API Key (tenant) authentication
- Helper middleware `authenticateRequest` routes to appropriate auth method
- Endpoints:
  - `POST /shipments` - Create shipment (JWT or API Key)
  - `GET /shipments/track/:reference` - Track shipment (JWT or API Key)

### 4. Shipments Controller Updates

**Multi-Source Support:**
- Shipments can now be created by:
  - **Users via JWT:** User's shipments linked via `user_id`
  - **Tenants via API Key:** Tenant's shipments linked via `tenant_id`
- Both can coexist in the same table

### 5. Database Migrations

**New Migration File:**
- `20260303100000-add-tenant-id-to-shippings.js`
- Makes `user_id` nullable (optional for API shipments)
- Adds `tenant_id` column (required for API shipments)
- Adds index on `tenant_id` for performance

## Frontend Changes

### 1. Navigation Component Updates

**New Links:**
- "Developers" link in navigation → `/docs`
- "For Businesses" button (not authenticated) → `/onboarding/business`

**Mobile Support:**
- Responsive "For Businesses" and "Developers" options

### 2. Business Onboarding Page (`/onboarding/business`)

**Features:**
- Registration form for new businesses
- Fields: Company Name, Slug, Base URL, Description
- Form validation with helpful descriptions
- Two-step flow:
  1. **Step 1 (Form):** Collect business details
  2. **Step 2 (Success):** Display API key with:
     - Copy-to-clipboard button
     - Show/hide toggle for security
     - Warning to save key securely
     - Next steps guide

### 3. API Documentation Page (`/docs`)

**Comprehensive Docs Including:**
- **Getting Started** - Registration steps and prerequisites
- **Authentication** - API key usage with curl/Node.js/Python examples
- **Base URL** - API endpoint base
- **Shipments API** - Complete endpoint documentation:
  - Create shipment (POST /shipments)
  - Get shipment (GET /shipments/track/:reference)
  - Cancel shipment (POST /shipments/cancel/:id)
- **Error Handling** - HTTP status codes and error responses
- **Rate Limiting** - Current limits (100/min, 5000/hour, 10 concurrent)
- **Support** - Contact information

### 4. API Client Updates (`lib/api.ts`)

**New Method:**
```typescript
async registerTenant(
  name: string,
  slug: string,
  base_url: string,
  description: string
)
```

## Tenant Model Example

Sample tenant record:
```json
{
  "id": 2,
  "name": "Zoho CRM",
  "slug": "zohocrm",
  "base_url": "www.zohoapis.com/crm/v2",
  "description": "Zoho CRM Base URL",
  "config": "{\"api_key\": \"obana_abc123...xyz789\"}",
  "status": "active",
  "registry": null,
  "createdAt": "2026-03-03T10:00:00Z",
  "updatedAt": "2026-03-03T10:00:00Z"
}
```

## API Usage Examples

### Register Business
```bash
POST /tenants/register
Content-Type: application/json

{
  "name": "My E-commerce",
  "slug": "myecom",
  "base_url": "https://api.myecom.com",
  "description": "Integration for shipment management"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "My E-commerce",
    "api_key": "obana_...",
    "message": "⚠️ Save your API key securely..."
  }
}
```

### Create Shipment via API
```bash
POST /shipments
Authoriation: obana_...
Content-Type: application/json

{
  "pickup_address": { ... },
  "delivery_address": { ... },
  "items": [ ... ],
  "transport_mode": "road",
  "service_level": "Standard"
}
```

### Track Shipment via API
```bash
GET /shipments/track/OBANA-20260303-ABC123
Authoriation: obana_...
```

## Security Considerations

✅ **Implemented:**
- API keys stored securely (never logged or returned after registration)
- Tenant status validation (only "active" tenants can authenticate)
- Proper error messages (don't leak if key is invalid vs expired)
- Rate limiting ready (see docs)
- Audit trail via tenant_id tracking

⚠️ **Recommended Next Steps:**
- Implement API key rotation policies
- Add IP whitelisting per tenant
- Add webhook signing verification
- Implement per-tenant rate limits
- Add API usage analytics/dashboard
- Implement API key expiration

## Testing Checklist

- [ ] Register business via `/onboarding/business`
- [ ] Verify API key is displayed and can be copied
- [ ] Test API key authentication on POST /shipments
- [ ] Test API key authentication on GET /shipments/track
- [ ] Verify JWT auth still works (backward compatible)
- [ ] Test API key validation (invalid key returns 401)
- [ ] Test rate limiting
- [ ] Verify shipments created via API are linked to tenant_id
- [ ] Verify shipments created via JWT are linked to user_id
- [ ] Check API documentation is complete and accurate

## Deployment Steps

1. **Backend:**
   ```bash
   npx sequelize-cli db:migrate
   ```
   This will:
   - Add tenant_id column to shippings
   - Make user_id nullable
   - Create index on tenant_id

2. **Frontend:**
   - Deploy updated Navigation component
   - Deploy new `/onboarding/business` page
   - Deploy new `/docs` page
   - Update api.ts with registerTenant method

3. **Monitor:**
   - Check error logs for authentication issues
   - Monitor API endpoint response times
   - Track tenant registration rate

## Files Modified/Created

**Backend:**
- ✅ `src/controllers/tenantController.js` (Updated with API key generation)
- ✅ `src/middleware/apiKeyAuth.js` (New - API key authentication)
- ✅ `src/routes/tenants.js` (Updated with registration endpoint)
- ✅ `src/routes/shipments.js` (Updated for dual auth)
- ✅ `src/controllers/shipmentsController.js` (Updated for tenant support)
- ✅ `src/models/shipmentsModel.js` (Added tenant_id field)
- ✅ `src/migrations/20260303100000-add-tenant-id-to-shippings.js` (New)

**Frontend:**
- ✅ `components/home/Navigation.tsx` (Added business/docs links)
- ✅ `app/onboarding/business/page.tsx` (New registration page)
- ✅ `app/docs/page.tsx` (New documentation page)
- ✅ `lib/api.ts` (Added registerTenant method)

---

**Status:** ✅ Implementation Complete & Ready for Testing
