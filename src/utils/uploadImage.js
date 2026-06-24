// Direct browser-to-Cloudinary unsigned upload

const CLOUD_NAME = 'dvqndnokl';
const UPLOAD_PRESET = 'profilephoto';

export async function uploadImage(dataUrl) {
  try {
    const formData = new FormData();
    formData.append('file', dataUrl); // Cloudinary natively accepts Base64 DataURI
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'pariksha_snapshots');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null; // Return null on failure, we don't want to crash exam submission
  }
}
