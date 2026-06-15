
/**
 * Currency formatting utilities for Vietnamese Dong (VND)
 */

/**
 * Formats a number for display with Vietnamese currency symbol
 * @param {number} n - The number to format
 * @returns {string} Formatted string with VND symbol (e.g., "106.000.000đ")
 */
export const formatVNDDisplay = (n) => {
  const num = Number(n);
  if (isNaN(num)) return '0đ';
  return `${new Intl.NumberFormat('vi-VN').format(num)}đ`;
};

/**
 * Formats a number for input field display (without currency symbol)
 * @param {number} n - The number to format
 * @returns {string} Formatted string with commas (e.g., "106,000,000")
 */
export const formatCurrencyInput = (n) => {
  if (n === null || n === undefined) return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  // Format with commas as thousand separators
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Parses a formatted currency string back to a number
 * @param {string} str - The formatted currency string (e.g., "106,000,000" or "106.000.000")
 * @returns {number} Parsed number
 */
export const parseCurrencyInput = (str) => {
  if (!str) return 0;
  // Remove all separator characters (commas and dots)
  const cleaned = str.toString().replace(/[,.]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
};

/**
 * Legacy function: Formats a number for display with Vietnamese currency symbol
 * @param {number} amount - The amount to format
 * @returns {string} Formatted string with VND symbol
 */
export const formatVND = (amount) => {
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount) || 0)}đ`;
};

/**
 * Legacy function: Parses a currency value to number
 * @param {string|number} value - The value to parse
 * @returns {number} Parsed number
 */
export const parseVND = (value) => {
  if (!value) return 0;
  const numericValue = value.toString().replace(/[^0-9-]/g, '');
  return parseInt(numericValue, 10) || 0;
};
