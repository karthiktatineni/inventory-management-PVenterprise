import { db } from './firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';

export const seedProducts = async () => {
  const products = [
    { name: "Premium Brake Pad Set", category: "Brakes", sku: "PV-BRK-001", price: 1250, costPrice: 850, quantity: 100, unit: "set", lowStockThreshold: 15 },
    { name: "Synthetic Engine Oil 5W-40", category: "Lubricants", sku: "PV-OIL-002", price: 3400, costPrice: 2800, quantity: 100, unit: "ltr", lowStockThreshold: 10 },
    { name: "LED Headlight Bulb H7", category: "Lighting", sku: "PV-LIT-003", price: 850, costPrice: 450, quantity: 100, unit: "pair", lowStockThreshold: 20 },
    { name: "All-Weather Floor Mats", category: "Interior", sku: "PV-INT-004", price: 1800, costPrice: 1100, quantity: 100, unit: "set", lowStockThreshold: 12 },
    { name: "Silicon Wiper Blades", category: "Exterior", sku: "PV-EXT-005", price: 450, costPrice: 220, quantity: 100, unit: "pair", lowStockThreshold: 15 }
  ];

  for (const p of products) {
    await addDoc(collection(db, 'products'), {
      ...p,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Seed initial shop settings
  await setDoc(doc(db, 'settings', 'shopConfig'), {
    shopName: 'PV Enterprises',
    shopAddress: 'Shop No G-1 JBS Towers, Bachupally, Hyderabad',
    shopPhone: '7893008877',
    gstNumber: '36AAAAA0000A1Z5',
    gstPercent: 18,
    lowStockGlobalThreshold: 20,
    ownerEmail: 'owner@pventerprises.com'
  });

  // Seed default owner record in Firestore
  // Note: This requires manual creation of 'owner@example.com' in Firebase Auth
  await setDoc(doc(db, 'users', 'OWNER_UID_PLACEHOLDER'), {
    name: 'Shop Owner',
    email: 'owner@gmail.com',
    role: 'owner',
    createdAt: serverTimestamp()
  });
};
