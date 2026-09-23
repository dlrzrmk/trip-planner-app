// Minimal Cloudinary REST API wrapper — no SDK dependency, just fetch + crypto
// (Node 18+ has both natively, including global FormData/Blob).
//
// Setup (one-time, done by the site owner, not by this code):
//   1. Create a free account at https://cloudinary.com
//   2. On the dashboard you'll see "Cloud name", "API Key" and "API Secret".
//      Set them as CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
//      CLOUDINARY_API_SECRET in the backend's environment variables
//      (Render > service > Environment).
//   Free tier is generous (25 GB storage / 25 GB bandwidth per month) and
//   Cloudinary automatically compresses/optimizes uploaded photos.
const crypto = require('crypto');

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

function sign(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

// dataUri: a "data:image/jpeg;base64,...." string, as produced by a <canvas>.toDataURL()
// on the client. Returns { url, public_id }.
async function uploadImage(dataUri, folder = 'voyago') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!isConfigured()) {
    throw new Error(
      'Cloudinary yapılandırılmamış (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET eksik).'
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ folder, timestamp }, apiSecret);

  const form = new FormData();
  form.append('file', dataUri);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloudinary yükleme hatası (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { url: data.secure_url, public_id: data.public_id };
}

async function deleteImage(publicId) {
  if (!publicId || !isConfigured()) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  try {
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: form });
  } catch (err) {
    console.error('Cloudinary silme hatası:', err);
  }
}

module.exports = { isConfigured, uploadImage, deleteImage };
