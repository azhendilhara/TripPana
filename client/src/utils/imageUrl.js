/**
 * Shared Image URL Resolver for TripPana
 *
 * Rules:
 * 1. If image is null, undefined, or empty -> return local placeholder image ('/placeholder.jpg')
 * 2. If image path begins with 'http://' or 'https://' -> return unchanged (legacy external images)
 * 3. If image path begins with '/uploads/' (or 'uploads/') -> prefix backend base URL
 * 4. Normalizes trailing and leading slashes safely.
 */

export const PLACEHOLDER_IMAGE = '/placeholder.jpg';

const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'http://localhost:5000';

// Remove any trailing slash from base URL
export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

export function resolveImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return PLACEHOLDER_IMAGE;
  }

  const trimmed = imagePath.trim();
  if (!trimmed) {
    return PLACEHOLDER_IMAGE;
  }

  // Already a full external or absolute HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Local uploaded image path
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_BASE_URL}${cleanPath}`;
  }

  // If path is already a root-relative local frontend asset (e.g., /placeholder.jpg or /images/...)
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Fallback for any other relative path
  return `${API_BASE_URL}/${trimmed}`;
}

export default resolveImageUrl;
