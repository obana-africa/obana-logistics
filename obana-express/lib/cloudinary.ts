export const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  // Ensure you have an unsigned upload preset named 'obana_preset' in Cloudinary settings
  formData.append("upload_preset", "obana_preset");
  const cloudName = "dgwmkzgsb"; 
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Cloudinary Upload Error:", error);
    throw new Error(error.error?.message || "Image upload failed");
  }
  const data = await res.json();
  return data.secure_url;
};