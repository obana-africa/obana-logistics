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

module.exports = { uploadImage };