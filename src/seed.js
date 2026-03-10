import { supabase } from './supabase';

export const seedProducts = async () => {
  const products = [
    { name: "Premium Brake Pad Set", category: "Brakes", sku: "PV-BRK-001", price: 1250, cost_price: 850, quantity: 100, unit: "set", low_stock_threshold: 15, image_url: "/WhatsApp Image 2026-03-10 at 8.58.12 AM.jpeg" },
    { name: "Synthetic Engine Oil 5W-40", category: "Lubricants", sku: "PV-OIL-002", price: 3400, cost_price: 2800, quantity: 100, unit: "ltr", low_stock_threshold: 10, image_url: "/WhatsApp Image 2026-03-10 at 8.58.13 AM.jpeg" },
    { name: "LED Headlight Bulb H7", category: "Lighting", sku: "PV-LIT-003", price: 850, cost_price: 450, quantity: 100, unit: "pair", low_stock_threshold: 20, image_url: "/WhatsApp Image 2026-03-10 at 8.58.13 AM (1).jpeg" },
    { name: "All-Weather Floor Mats", category: "Interior", sku: "PV-INT-004", price: 1800, cost_price: 1100, quantity: 100, unit: "set", low_stock_threshold: 12, image_url: "/WhatsApp Image 2026-03-10 at 8.58.14 AM.jpeg" },
    { name: "Silicon Wiper Blades", category: "Exterior", sku: "PV-EXT-005", price: 450, cost_price: 220, quantity: 100, unit: "pair", low_stock_threshold: 15, image_url: "/WhatsApp Image 2026-03-10 at 8.58.14 AM (1).jpeg" }
  ];

  // Insert Products into Supabase
  const { error: pError } = await supabase.from('products').insert(products);
  if (pError) console.error('Seed Products Error:', pError);

  // Seed initial shop settings into Supabase
  const { error: sError } = await supabase.from('settings').upsert({
    id: 'shopConfig',
    shop_name: 'PV Enterprises',
    shop_address: 'Shop No G-1 JBS Towers, Bachupally, Hyderabad',
    shop_phone: '7893008877',
    gst_number: '36AAAAA0000A1Z5',
    gst_percent: 18,
    low_stock_global_threshold: 20,
    owner_email: 'owner@pventerprises.com'
  });
  if (sError) console.error('Seed Settings Error:', sError);
};
