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

module.exports = { uploadImage, uploadDocument };