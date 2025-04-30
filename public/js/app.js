// Constants
const API_BASE_URL = 'http://localhost:3000/api';
let currentInvoiceId = null;

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const invoiceFile = document.getElementById('invoiceFile');
const uploadBtn = document.getElementById('uploadBtn');
const invoicesList = document.getElementById('invoicesList');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const deleteInvoiceBtn = document.getElementById('deleteInvoiceBtn');
const alertContainer = document.getElementById('alertContainer');

// Bootstrap Modal
const invoiceDetailsModal = new bootstrap.Modal(document.getElementById('invoiceDetailsModal'));

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadInvoices();
  
  uploadForm.addEventListener('submit', handleUpload);
  searchForm.addEventListener('submit', handleSearch);
  refreshBtn.addEventListener('click', loadInvoices);
  deleteInvoiceBtn.addEventListener('click', handleDeleteInvoice);
});

// Functions
async function loadInvoices() {
  try {
    showEmptyState(false);
    invoicesList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading invoices...</div>';
    
    const response = await fetch(`${API_BASE_URL}/invoices`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load invoices');
    }
    
    console.log('Loaded invoices:', data.data); // Debug log
    renderInvoicesList(data.data);
  } catch (error) {
    console.error('Error in loadInvoices:', error); // Enhanced error logging
    showAlert('danger', `Error: ${error.message}`);
    showEmptyState(true, 'Failed to load invoices. Please try again.');
  }
}

function renderInvoicesList(invoices) {
  if (!invoices || invoices.length === 0) {
    showEmptyState(true);
    return;
  }
  
  invoicesList.innerHTML = '';
  
  invoices.forEach(invoice => {
    // More robust date handling
    let invoiceDate;
    try {
      // Try to parse invoice date or fallback to upload date
      const dateValue = invoice.date || invoice.uploadDate;
      invoiceDate = dateValue ? new Date(dateValue).toLocaleDateString() : 'No date';
    } catch (e) {
      invoiceDate = 'Invalid date';
      console.warn('Date parsing error:', e);
    }
    
    // Handle various total amount formats
    let amount = 'N/A';
    if (invoice.totalAmount) {
      // Clean up the amount value
      if (typeof invoice.totalAmount === 'string') {
        // Try to extract numeric value if it's a string with currency symbols
        amount = invoice.totalAmount.trim();
      } else if (typeof invoice.totalAmount === 'number') {
        amount = formatCurrency(invoice.totalAmount);
      }
    }
    
    const listItem = document.createElement('div');
    listItem.className = 'list-group-item invoice-item';
    listItem.dataset.id = invoice._id;
    listItem.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="invoice-vendor">${sanitize(invoice.vendorName || 'Unknown Vendor')}</div>
          <div class="invoice-number">Invoice #: ${sanitize(invoice.invoiceNumber || 'N/A')}</div>
          <div class="invoice-date">Date: ${invoiceDate}</div>
        </div>
        <div class="text-end">
          <div class="invoice-amount">${sanitize(amount)}</div>
          <small class="text-muted">${timeAgo(new Date(invoice.uploadDate))}</small>
        </div>
      </div>
    `;
    
    listItem.addEventListener('click', () => showInvoiceDetails(invoice));
    invoicesList.appendChild(listItem);
  });
}

function showEmptyState(show, message = null) {
  if (show) {
    emptyState.style.display = 'block';
    if (message) {
      emptyState.querySelector('p').textContent = message;
    } else {
      emptyState.querySelector('p').textContent = 'No invoices found. Upload your first invoice to get started.';
    }
    invoicesList.innerHTML = '';
  } else {
    emptyState.style.display = 'none';
  }
}

async function handleUpload(event) {
  event.preventDefault();
  
  const fileInput = invoiceFile;
  if (!fileInput.files || fileInput.files.length === 0) {
    showAlert('warning', 'Please select a file to upload');
    return;
  }
  
  const formData = new FormData();
  formData.append('invoice', fileInput.files[0]);
  
  try {
    // Show loading state
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
    loadingIndicator.classList.remove('d-none');
    
    const response = await fetch(`${API_BASE_URL}/invoices/upload`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Upload failed');
    }
    
    showAlert('success', 'Invoice uploaded and analyzed successfully');
    uploadForm.reset();
    loadInvoices();
    showInvoiceDetails(data.data);
  } catch (error) {
    console.error('Upload error:', error); // Enhanced error logging
    showAlert('danger', `Error: ${error.message}`);
  } finally {
    // Reset loading state
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Upload & Analyze';
    loadingIndicator.classList.add('d-none');
  }
}

async function handleSearch(event) {
  event.preventDefault();
  
  const query = searchInput.value.trim();
  if (!query) {
    loadInvoices();
    return;
  }
  
  try {
    showEmptyState(false);
    invoicesList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Searching...</div>';
    
    // Fix: Updated to match backend's endpoint parameter name (query instead of q)
    const response = await fetch(`${API_BASE_URL}/invoices/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Search failed');
    }
    
    renderInvoicesList(data.data);
    
    if (data.data.length === 0) {
      showEmptyState(true, `No invoices found matching "${query}"`);
    }
  } catch (error) {
    console.error('Search error:', error); // Enhanced error logging
    showAlert('danger', `Error: ${error.message}`);
    showEmptyState(true, 'Search failed. Please try again.');
  }
}

function showInvoiceDetails(invoice) {
  console.log('Showing details for invoice:', invoice); // Debug log
  
  // Set current invoice ID for delete operation
  currentInvoiceId = invoice._id;
  
  // Set modal title
  document.getElementById('invoiceDetailsModalLabel').textContent = `Invoice: ${sanitize(invoice.invoiceNumber || 'N/A')}`;
  
  // Fill in basic invoice details
  document.getElementById('modalVendor').textContent = sanitize(invoice.vendorName || 'Unknown Vendor');
  document.getElementById('modalInvoiceNumber').textContent = sanitize(invoice.invoiceNumber || 'N/A');
  
  // Handle date fields with more robustness
  try {
    document.getElementById('modalUploadDate').textContent = new Date(invoice.uploadDate).toLocaleString();
  } catch (e) {
    document.getElementById('modalUploadDate').textContent = 'Invalid date';
  }
  
  document.getElementById('modalDate').textContent = formatDate(invoice.date);
  document.getElementById('modalDueDate').textContent = formatDate(invoice.dueDate);
  
  // Handle amount information fields with better error handling
  let subtotal = 0;
  try {
    subtotal = calculateSubtotal(invoice);
    document.getElementById('modalSubtotal').textContent = formatCurrency(subtotal);
  } catch (e) {
    console.warn('Error calculating subtotal:', e);
    document.getElementById('modalSubtotal').textContent = 'N/A';
  }
  
  try {
    document.getElementById('modalTax').textContent = formatCurrency(invoice.taxAmount || '0');
  } catch (e) {
    document.getElementById('modalTax').textContent = 'N/A';
  }
  
  try {
    document.getElementById('modalTotal').textContent = formatCurrency(invoice.totalAmount || '0');
  } catch (e) {
    document.getElementById('modalTotal').textContent = 'N/A';
  }
  
  // Additional information
  document.getElementById('modalPaymentTerms').textContent = sanitize(invoice.paymentTerms || 'Not specified');
  document.getElementById('modalNotes').textContent = sanitize(invoice.notes || 'No notes available');
  
  // Populate line items
  const lineItemsContainer = document.getElementById('modalLineItems');
  lineItemsContainer.innerHTML = '';
  
  if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    invoice.items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sanitize(item.description || 'No description')}</td>
        <td>${sanitize(item.quantity || '1')}</td>
        <td>${formatCurrency(item.unitPrice || '0')}</td>
        <td>${formatCurrency(item.amount || '0')}</td>
      `;
      lineItemsContainer.appendChild(row);
    });
  } else {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="text-center">No line items available</td>';
    lineItemsContainer.appendChild(row);
  }
  
  // Show the modal
  invoiceDetailsModal.show();
}

async function handleDeleteInvoice() {
  if (!currentInvoiceId) {
    showAlert('warning', 'No invoice selected for deletion');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${currentInvoiceId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete invoice');
    }
    
    showAlert('success', 'Invoice deleted successfully');
    invoiceDetailsModal.hide();
    loadInvoices();
  } catch (error) {
    console.error('Delete error:', error); // Enhanced error logging
    showAlert('danger', `Error: ${error.message}`);
  }
}

// Helper functions
function showAlert(type, message) {
  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type} alert-dismissible fade show`;
  alertEl.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertEl);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    alertEl.classList.remove('show');
    setTimeout(() => alertEl.remove(), 150);
  }, 5000);
}

function sanitize(str) {
  if (str === null || str === undefined) return '';
  
  // Convert to string if it's not already
  str = String(str);
  
  // Replace HTML special chars
  return str.replace(/[&<>"']/g, function(match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match];
  });
}

function formatDate(dateStr) {
  if (!dateStr) return 'Not specified';
  
  try {
    // Try to parse the date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // If invalid, return original string
    return date.toLocaleDateString();
  } catch (error) {
    console.warn('Date formatting error:', error);
    return dateStr;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '$0.00';
  
  // Try to convert to number if it's a string
  let numAmount;
  try {
    if (typeof amount === 'string') {
      // Remove currency symbols and commas
      numAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
    } else {
      numAmount = parseFloat(amount);
    }
    
    // If conversion failed or NaN, return default
    if (isNaN(numAmount)) return '$0.00';
    
    // Format as currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  } catch (error) {
    console.warn('Currency formatting error:', error);
    return '$0.00';
  }
}

function calculateSubtotal(invoice) {
  // Handle case when no invoice is provided
  if (!invoice) return 0;
  
  if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    // If no items or total amount is available, return the total amount
    const totalAmount = invoice.totalAmount || 0;
    
    if (typeof totalAmount === 'string') {
      // Try to extract numeric value if it's a string with currency symbols
      const cleanAmount = totalAmount.replace(/[^0-9.-]+/g, '');
      return parseFloat(cleanAmount) || 0;
    }
    
    return totalAmount;
  }
  
  // Calculate subtotal by summing item amounts
  return invoice.items.reduce((total, item) => {
    if (!item) return total;
    
    let amount = 0;
    try {
      if (item.amount) {
        if (typeof item.amount === 'string') {
          amount = parseFloat(item.amount.replace(/[^0-9.-]+/g, '')) || 0;
        } else {
          amount = parseFloat(item.amount) || 0;
        }
      }
    } catch (e) {
      console.warn('Error parsing item amount:', e);
    }
    
    return total + amount;
  }, 0);
}

function timeAgo(date) {
  try {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + ' years ago';
    if (interval === 1) return 'a year ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + ' months ago';
    if (interval === 1) return 'a month ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + ' days ago';
    if (interval === 1) return 'yesterday';
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + ' hours ago';
    if (interval === 1) return 'an hour ago';
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + ' minutes ago';
    if (interval === 1) return 'a minute ago';
    
    return 'just now';
  } catch (e) {
    console.warn('Error in timeAgo calculation:', e);
    return 'recently';
  }
}