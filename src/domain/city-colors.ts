/**
 * Indian Monopoly - City Color Ramps & High-Contrast Palettes
 * Maps city deed buying prices (₹600 to ₹4,000) to green shades spectrum,
 * from light mint/spring green to deep royal emerald pine green.
 */

export const getCityPriceColor = (price: number): string => {
  if (price <= 600) return '#D1FADF'; // Jaipur, Jodhpur (Light Mint Green)
  if (price <= 800) return '#BBF7D0'; // Udaipur (Soft Pastel Green)
  if (price <= 1000) return '#A7F3D0'; // Agra, Lucknow (Crisp Spring Green)
  if (price <= 1200) return '#86EFAC'; // Varanasi (Light Meadow Green)
  if (price <= 1400) return '#4ADE80'; // Indore, Bhopal (Fresh Green)
  if (price <= 1600) return '#34D399'; // Surat (Vivid Emerald Mint)
  if (price <= 1800) return '#22C55E'; // Visakhapatnam, Kochi (Vibrant Emerald)
  if (price <= 2000) return '#16A34A'; // Goa (Rich Grass Green)
  if (price <= 2200) return '#15803D'; // Ahmedabad, Pune (Forest Green)
  if (price <= 2400) return '#166534'; // Hyderabad (Deep Pine Green)
  if (price <= 2600) return '#14532D'; // Bengaluru, Chennai (Dark Evergreen)
  if (price <= 2800) return '#0F4824'; // Kolkata (Hunter Green)
  if (price <= 3000) return '#0B3C1D'; // Chandigarh (Dark Jade)
  if (price <= 3200) return '#064E3B'; // Gurugram, Noida (Royal Deep Green)
  if (price <= 3500) return '#063A2D'; // Navi Mumbai (Imperial Pine)
  if (price <= 3800) return '#042D23'; // New Delhi (Midnight Emerald)
  return '#02241C'; // Mumbai (₹4,000 Supreme Deep Green)
};

export const getCityTextColor = (price: number): string => {
  if (price <= 1400) {
    return '#022C22'; // High-contrast deep dark pine/black text on light green
  }
  return '#FFFFFF'; // High-contrast crisp white text on medium to deep dark green
};

export const getCityBorderColor = (price: number): string => {
  if (price <= 1400) {
    return '#16A34A'; // Defined green border for light green grids
  }
  return '#064E3B'; // Deep emerald border for dark green grids
};
