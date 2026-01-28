// lib/taxes.js
// Tax rates for Canada and USA

// Canadian Tax Rates (as of 2024)
export const CANADA_TAXES = {
  AB: { name: 'Alberta', gst: 5, pst: 0, hst: 0, total: 5, type: 'GST' },
  BC: { name: 'British Columbia', gst: 5, pst: 7, hst: 0, total: 12, type: 'GST + PST' },
  MB: { name: 'Manitoba', gst: 5, pst: 7, hst: 0, total: 12, type: 'GST + PST' },
  NB: { name: 'New Brunswick', gst: 0, pst: 0, hst: 15, total: 15, type: 'HST' },
  NL: { name: 'Newfoundland and Labrador', gst: 0, pst: 0, hst: 15, total: 15, type: 'HST' },
  NS: { name: 'Nova Scotia', gst: 0, pst: 0, hst: 15, total: 15, type: 'HST' },
  NT: { name: 'Northwest Territories', gst: 5, pst: 0, hst: 0, total: 5, type: 'GST' },
  NU: { name: 'Nunavut', gst: 5, pst: 0, hst: 0, total: 5, type: 'GST' },
  ON: { name: 'Ontario', gst: 0, pst: 0, hst: 13, total: 13, type: 'HST' },
  PE: { name: 'Prince Edward Island', gst: 0, pst: 0, hst: 15, total: 15, type: 'HST' },
  QC: { name: 'Quebec', gst: 5, pst: 9.975, hst: 0, total: 14.975, type: 'GST + QST' },
  SK: { name: 'Saskatchewan', gst: 5, pst: 6, hst: 0, total: 11, type: 'GST + PST' },
  YT: { name: 'Yukon', gst: 5, pst: 0, hst: 0, total: 5, type: 'GST' }
};

// US State Tax Rates for SaaS/Digital Services
// Note: Many states don't tax SaaS, but some do. This includes states that tax digital services.
export const USA_TAXES = {
  AL: { name: 'Alabama', rate: 4, type: 'Sales Tax' },
  AZ: { name: 'Arizona', rate: 5.6, type: 'Sales Tax' },
  AR: { name: 'Arkansas', rate: 6.5, type: 'Sales Tax' },
  CA: { name: 'California', rate: 0, type: 'No SaaS Tax' }, // CA doesn't tax SaaS
  CO: { name: 'Colorado', rate: 2.9, type: 'Sales Tax' },
  CT: { name: 'Connecticut', rate: 6.35, type: 'Sales Tax' },
  DC: { name: 'District of Columbia', rate: 6, type: 'Sales Tax' },
  DE: { name: 'Delaware', rate: 0, type: 'No Sales Tax' },
  FL: { name: 'Florida', rate: 6, type: 'Sales Tax' },
  GA: { name: 'Georgia', rate: 4, type: 'Sales Tax' },
  HI: { name: 'Hawaii', rate: 4, type: 'GET' },
  ID: { name: 'Idaho', rate: 6, type: 'Sales Tax' },
  IL: { name: 'Illinois', rate: 6.25, type: 'Sales Tax' },
  IN: { name: 'Indiana', rate: 7, type: 'Sales Tax' },
  IA: { name: 'Iowa', rate: 6, type: 'Sales Tax' },
  KS: { name: 'Kansas', rate: 6.5, type: 'Sales Tax' },
  KY: { name: 'Kentucky', rate: 6, type: 'Sales Tax' },
  LA: { name: 'Louisiana', rate: 4.45, type: 'Sales Tax' },
  ME: { name: 'Maine', rate: 5.5, type: 'Sales Tax' },
  MD: { name: 'Maryland', rate: 6, type: 'Sales Tax' },
  MA: { name: 'Massachusetts', rate: 6.25, type: 'Sales Tax' },
  MI: { name: 'Michigan', rate: 6, type: 'Sales Tax' },
  MN: { name: 'Minnesota', rate: 6.875, type: 'Sales Tax' },
  MS: { name: 'Mississippi', rate: 7, type: 'Sales Tax' },
  MO: { name: 'Missouri', rate: 4.225, type: 'Sales Tax' },
  MT: { name: 'Montana', rate: 0, type: 'No Sales Tax' },
  NE: { name: 'Nebraska', rate: 5.5, type: 'Sales Tax' },
  NV: { name: 'Nevada', rate: 6.85, type: 'Sales Tax' },
  NH: { name: 'New Hampshire', rate: 0, type: 'No Sales Tax' },
  NJ: { name: 'New Jersey', rate: 6.625, type: 'Sales Tax' },
  NM: { name: 'New Mexico', rate: 5.125, type: 'GRT' },
  NY: { name: 'New York', rate: 4, type: 'Sales Tax' },
  NC: { name: 'North Carolina', rate: 4.75, type: 'Sales Tax' },
  ND: { name: 'North Dakota', rate: 5, type: 'Sales Tax' },
  OH: { name: 'Ohio', rate: 5.75, type: 'Sales Tax' },
  OK: { name: 'Oklahoma', rate: 4.5, type: 'Sales Tax' },
  OR: { name: 'Oregon', rate: 0, type: 'No Sales Tax' },
  PA: { name: 'Pennsylvania', rate: 6, type: 'Sales Tax' },
  RI: { name: 'Rhode Island', rate: 7, type: 'Sales Tax' },
  SC: { name: 'South Carolina', rate: 6, type: 'Sales Tax' },
  SD: { name: 'South Dakota', rate: 4.5, type: 'Sales Tax' },
  TN: { name: 'Tennessee', rate: 7, type: 'Sales Tax' },
  TX: { name: 'Texas', rate: 6.25, type: 'Sales Tax' },
  UT: { name: 'Utah', rate: 6.1, type: 'Sales Tax' },
  VT: { name: 'Vermont', rate: 6, type: 'Sales Tax' },
  VA: { name: 'Virginia', rate: 5.3, type: 'Sales Tax' },
  WA: { name: 'Washington', rate: 6.5, type: 'Sales Tax' },
  WV: { name: 'West Virginia', rate: 6, type: 'Sales Tax' },
  WI: { name: 'Wisconsin', rate: 5, type: 'Sales Tax' },
  WY: { name: 'Wyoming', rate: 4, type: 'Sales Tax' }
};

// Calculate tax for a given amount
export function calculateTax(amount, country, region) {
  if (country === 'CA') {
    const taxInfo = CANADA_TAXES[region] || CANADA_TAXES.ON;
    const taxAmount = amount * (taxInfo.total / 100);
    return {
      subtotal: amount,
      taxRate: taxInfo.total,
      taxType: taxInfo.type,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((amount + taxAmount) * 100) / 100,
      breakdown: taxInfo.hst > 0 
        ? { hst: Math.round(amount * taxInfo.hst / 100 * 100) / 100 }
        : { 
            gst: Math.round(amount * taxInfo.gst / 100 * 100) / 100,
            pst: taxInfo.pst > 0 ? Math.round(amount * taxInfo.pst / 100 * 100) / 100 : 0
          }
    };
  } else if (country === 'US') {
    const taxInfo = USA_TAXES[region] || { rate: 0, type: 'No Tax Info' };
    const taxAmount = amount * (taxInfo.rate / 100);
    return {
      subtotal: amount,
      taxRate: taxInfo.rate,
      taxType: taxInfo.type,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((amount + taxAmount) * 100) / 100,
      breakdown: { salesTax: Math.round(taxAmount * 100) / 100 }
    };
  }
  
  return {
    subtotal: amount,
    taxRate: 0,
    taxType: 'No Tax',
    taxAmount: 0,
    total: amount,
    breakdown: {}
  };
}

// Get tax description for display
export function getTaxDescription(country, region) {
  if (country === 'CA') {
    const taxInfo = CANADA_TAXES[region];
    if (!taxInfo) return 'Plus applicable taxes';
    return `Plus ${taxInfo.type} (${taxInfo.total}%)`;
  } else if (country === 'US') {
    const taxInfo = USA_TAXES[region];
    if (!taxInfo || taxInfo.rate === 0) return 'No sales tax applicable';
    return `Plus ${taxInfo.type} (${taxInfo.rate}%)`;
  }
  return 'Plus applicable taxes';
}
