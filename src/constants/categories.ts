export const BUSINESS_TYPES = [
  { value: "food_items", label: "Food Items" },
  { value: "fashion_clothing", label: "Fashion & Clothing" },
  { value: "electronics", label: "Electronics" },
  { value: "provisions", label: "Provisions" },
  { value: "raw_materials", label: "Raw Materials" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "agriculture", label: "Agriculture" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
] as const;

export const LANGUAGES = [
  { value: "pidgin", label: "Nigerian Pidgin" },
  { value: "yoruba", label: "Yoruba" },
  { value: "igbo", label: "Igbo" },
  { value: "hausa", label: "Hausa" },
  { value: "english", label: "English" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "stock_purchase", label: "Stock Purchase" },
  { value: "transportation", label: "Transportation" },
  { value: "market_levy", label: "Market Levy" },
  { value: "shop_rent", label: "Shop Rent" },
  { value: "labor", label: "Labor" },
  { value: "utilities", label: "Utilities" },
  { value: "communication", label: "Communication" },
  { value: "packaging", label: "Packaging" },
  { value: "equipment", label: "Equipment" },
  { value: "personal", label: "Personal" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "other", label: "Other" },
] as const;

export const PAYMENT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS" },
  { value: "credit", label: "Credit" },
  { value: "mixed", label: "Mixed" },
] as const;

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
