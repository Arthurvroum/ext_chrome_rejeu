/**
 * Utility functions for formatting data in the application
 */

/**
 * Format JSON data for display
 * @param {any} data - The data to format
 * @returns {string} - Formatted string representation
 */
export function formatJson(data) {
  if (data === undefined || data === null) return 'No data available';
  
  try {
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    } else if (typeof data === 'string') {
      // Try to parse as JSON if it's a string
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, just return the string
        return data;
      }
    }
    // Handle other types
    return String(data);
  } catch (e) {
    console.error('Error formatting JSON:', e);
    return String(data);
  }
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
export function truncateString(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format a date as a locale string
 * @param {Date|string|number} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString();
}

/**
 * Extract path from URL
 * @param {string} url - Full URL
 * @returns {string} - Path portion of URL
 */
export function getPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch (e) {
    return url;
  }
}

/**
 * Check if a URL is relative (doesn't have protocol or starting slash)
 * @param {string} url - URL to check
 * @returns {boolean} - True if the URL is relative
 */
export function isRelativeUrl(url) {
  if (!url) return false;
  
  // A URL is relative if it doesn't start with a protocol or a slash
  // This regex checks if the URL has a protocol like http:// or https://
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url);
  
  // Also considered absolute if it starts with a slash or double slash
  const isAbsolutePath = url.startsWith('/') || url.startsWith('//');
  
  return !hasProtocol && !isAbsolutePath;
}
