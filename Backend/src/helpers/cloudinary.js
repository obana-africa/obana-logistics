const cloudinary = require('cloudinary').v2;
require("dotenv").config();

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadImage = async (fileStr, folder) => {
    try {
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            folder: folder
        });
        return uploadResponse.secure_url;
    } catch (err) {
        console.error('Cloudinary Upload Error:', err);
        throw new Error('Failed to upload image to Cloudinary');
    }
};

/**
 * Any file a shipment carries — a waybill PDF, a packing list, a photograph.
 *
 * `resource_type: 'auto'` is the difference from uploadImage above: without
 * it Cloudinary treats everything as an image and a PDF comes back as a
 * broken one. Shipment papers are mostly PDFs.
 */
const uploadDocument = async (fileStr, folder) => {
    /* Say which credential is missing before asking Cloudinary. Without them
       every upload fails with "Must supply api_key", which reads like a bug in
       the request rather than three unset variables on the service. */
    const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
        .filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) {
        const error = new Error(`Cloudinary is not configured on this server (${missing.join(', ')} not set)`);
        error.reason = error.message;
        throw error;
    }

    try {
        const uploaded = await cloudinary.uploader.upload(fileStr, {
            folder,
            resource_type: 'auto',
        });
        return uploaded.secure_url;
    } catch (err) {
        console.error('Cloudinary Upload Error:', err);
        /* Carry Cloudinary's own words up. They name the cause — an unsupported
           file type, a size over the plan's limit, a bad key — and swallowing
           them left "the upload service refused it", which tells nobody what to
           change. None of it is secret. */
        const error = new Error('Failed to upload the document to Cloudinary');
        error.reason = err?.error?.message || err?.message || String(err);
        error.httpCode = err?.error?.http_code || err?.http_code || null;
        throw error;
    }
};

/**
 * The pieces of a Cloudinary delivery URL, so another one can be built from it.
 *
 * We keep the delivered link on the shipment, not the public id, because that
 * is what every screen needs. Signing a link needs the id back, so it is read
 * off the URL: .../<resource_type>/<type>/v<version>/<public id>.<format>
 *
 * Returns null for anything that is not a plain Cloudinary delivery URL — a
 * file hosted elsewhere, or one that already carries transformations, neither
 * of which can be re-signed from the outside.
 */
const assetFromUrl = (url) => {
    const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/(upload|authenticated)\/(?:(v\d+)\/)?(.+)$/.exec(String(url || ''))
    if (!match) return null
    const [, resourceType, type, version, rest] = match
    /* A transformation would sit between /upload/ and the version; without the
       original id those cannot be reproduced, so leave them alone. */
    if (!version && /^[a-z]{1,3}_[^/]+\//.test(rest)) return null
    const dot = rest.lastIndexOf('.')
    const slash = rest.lastIndexOf('/')
    const named = dot > slash
    return {
        resource_type: resourceType,
        type,
        version: version ? version.slice(1) : undefined,
        public_id: named ? rest.slice(0, dot) : rest,
        format: named ? rest.slice(dot + 1) : undefined,
    }
}

/**
 * The same file, as a link Cloudinary will actually serve.
 *
 * Cloudinary blocks PDF delivery by default — the asset is fine and its
 * rendered first page comes back happily, but asking for the PDF itself
 * answers 401 "deny or ACL failure". That is why a waybill could be viewed and
 * not downloaded. A signed link is the documented way through it, and signing
 * needs the account secret, which lives here and nowhere the browser can see.
 *
 * Returns null when the URL cannot be signed or the account is not configured,
 * so a caller can fall back to the plain link rather than fail.
 */
const signedDeliveryUrl = (url, { attachment = false } = {}) => {
    const asset = assetFromUrl(url)
    if (!asset) return null
    if (!String(process.env.CLOUDINARY_API_SECRET || '').trim()) return null
    try {
        return cloudinary.url(asset.public_id, {
            resource_type: asset.resource_type,
            type: asset.type,
            format: asset.format,
            /* Only when the source link carried one. Inventing a version puts
               a path on the URL that the asset was never delivered under. */
            ...(asset.version ? { version: asset.version } : { force_version: false }),
            secure: true,
            sign_url: true,
            /* Nothing here is rendered in a browser we own; the analytics
               parameter would only ride along into a redirect. */
            analytics: false,
            ...(attachment ? { flags: 'attachment' } : {}),
        })
    } catch (err) {
        console.error('Could not sign a Cloudinary link:', err?.message || err)
        return null
    }
}

/* Whether a link actually serves, remembered for a while.
 
   Every candidate is tried before anyone is sent to it, because the point of
   the exercise is not to hand a customer a 401 twice. The answer is cached so
   that costs one request per link rather than one per download — and only
   briefly, so turning the setting on in Cloudinary takes effect on its own. */
const servedCache = new Map()
const SERVES_FOR_MS = 10 * 60 * 1000

const serves = async (url) => {
    const cached = servedCache.get(url)
    if (cached && cached.until > Date.now()) return cached.ok
    let ok = false
    try {
        /* One byte is enough to learn whether it is allowed, and avoids
           pulling a whole document just to ask. */
        const response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
        ok = response.status === 200 || response.status === 206
        if (response.body?.cancel) await response.body.cancel().catch(() => {})
    } catch (err) {
        console.error('Could not check a document link:', err?.message || err)
        ok = false
    }
    servedCache.set(url, { ok, until: Date.now() + SERVES_FOR_MS })
    return ok
}

/** The unsigned "save this" form, which works when PDF delivery is allowed. */
const attachmentUrl = (url) =>
    /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\//.test(String(url || ''))
        ? String(url).replace('/upload/', '/upload/fl_attachment/')
        : url

/**
 * The best link to hand somebody for this document, or null if none works.
 *
 * Tried in order of what the reader wants: signed first, because that is the
 * one that works while PDF delivery is switched off, then the plain link, in
 * case the account is configured the other way or the file is hosted
 * elsewhere entirely.
 */
const deliverableUrl = async (url, { attachment = false } = {}) => {
    const candidates = attachment
        ? [signedDeliveryUrl(url, { attachment: true }), attachmentUrl(url), signedDeliveryUrl(url), url]
        : [signedDeliveryUrl(url), url]
    for (const candidate of candidates) {
        if (candidate && (await serves(candidate))) return candidate
    }
    return null
}

module.exports = { uploadImage, uploadDocument, signedDeliveryUrl, deliverableUrl, attachmentUrl };
