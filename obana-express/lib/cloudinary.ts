export const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  // Ensure you have an unsigned upload preset named 'obana_preset' in Cloudinary settings
  formData.append("upload_preset", "obana_preset");
  
  const cloudName = "deh6kg4sk"; 
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url;
};