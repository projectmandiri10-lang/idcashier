import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function exportToExcel(data, fileName, options = {}) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Apply column widths if provided
  if (options.columnWidths) {
    worksheet['!cols'] = options.columnWidths.map(width => ({ wch: width }));
  }
  
  const workbook = XLSX.utils.book_new();
  const sheetName = options.sheetName || 'Data';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Check if a subscription is still active
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {boolean} - True if subscription is active (endDate >= today)
 */
export function isSubscriptionActive(endDate) {
  if (!endDate) return false;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end >= today;
}

/**
 * Calculate subscription end date based on current subscription status
 * @param {Date} startDate - The start date for new subscription
 * @param {string|null} currentEndDate - Current end date in YYYY-MM-DD format (null if no subscription)
 * @param {number} months - Number of months to add
 * @returns {{start_date: string, end_date: string}} - Object with start_date and end_date in YYYY-MM-DD format
 */
export function calculateSubscriptionEndDate(startDate, currentEndDate, months) {
  let start, end;
  
  if (currentEndDate && isSubscriptionActive(currentEndDate)) {
    // If subscription is still active, extend from current end date
    start = new Date(currentEndDate);
    end = new Date(currentEndDate);
    end.setMonth(end.getMonth() + months);
  } else {
    // If no subscription or expired, start from provided start date
    start = new Date(startDate);
    end = new Date(startDate);
    end.setMonth(end.getMonth() + months);
  }
  
  // Format to YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    start_date: formatDate(start),
    end_date: formatDate(end)
  };
}