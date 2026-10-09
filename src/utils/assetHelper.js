import { storage, ref, uploadBytes, getDownloadURL } from '../firebase/config';

export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? `${baseUrl}${cleanPath}` : `${baseUrl}/${cleanPath}`;
};

/**
 * Upload image file to Firebase Storage if available, else compress to Data URL
 */
export const uploadImageFileToStorage = async (file) => {
  if (!file) return '';
  if (storage) {
    try {
      const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'photo.jpg';
      const storageRef = ref(storage, `products/${Date.now()}_${cleanFileName}`);
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase Storage upload timeout')), 2500)
      );

      const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
      const downloadURL = await getDownloadURL(snapshot.ref);
      if (downloadURL) return downloadURL;
    } catch (err) {
      console.warn("Firebase Storage upload fallback to compressed image:", err);
    }
  }
  return await compressImageFile(file, 800, 0.75);
};

/**
 * Compress image file using HTML5 Canvas (resizes large photos & reduces quality to JPEG ~50KB)
 */
export const compressImageFile = (file, maxWidth = 400, quality = 0.55) => {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    if (file.type === 'image/svg+xml' || file.size < 40000) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export const DEFAULT_FALLBACK_IMAGES = {
  WATCHES: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop',
  BELTS: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?q=80&w=800&auto=format&fit=crop',
  JEWELLERY: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop',
  PERFUMES: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=800&auto=format&fit=crop',
  DEFAULT: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop'
};

const isValidImageSource = (img) => {
  if (!img || typeof img !== 'string' || img.trim() === '') return false;
  if (img.startsWith('data:')) {
    // Basic base64 integrity check: must contain comma and have reasonable data length
    const parts = img.split(',');
    if (parts.length < 2 || parts[1].length < 100) return false;
  }
  return true;
};

export const getProductImages = (product) => {
  if (!product) return [DEFAULT_FALLBACK_IMAGES.DEFAULT];

  const cat = (product.category || '').toUpperCase();
  const fallbackImg = DEFAULT_FALLBACK_IMAGES[cat] || DEFAULT_FALLBACK_IMAGES.DEFAULT;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const valid = product.images.filter(isValidImageSource);
    if (valid.length > 0) return valid;
  }
  if (isValidImageSource(product.image)) {
    return [product.image];
  }
  return [fallbackImg];
};


