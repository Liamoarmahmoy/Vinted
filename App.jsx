import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, Package, ShoppingBag, Receipt, Calculator, ClipboardCheck,
  Tags, Truck, CalendarRange, Target, Settings as SettingsIcon, Search,
  Plus, Trash2, Pencil, X, Download, AlertTriangle, CheckCircle2, Menu,
  ArrowUpRight, ArrowDownRight, PackageCheck, Upload, ShieldCheck,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/*  CONSTANTS                                                              */
/* ---------------------------------------------------------------------- */

const BRANDS = ["Nike","Adidas","Ralph Lauren","Patagonia","The North Face","Columbia","Carhartt","Levi's","Tommy Hilfiger","Puma"];
const CATEGORIES = ["Fleeces","Jackets","Hoodies","T-Shirts","Jeans","Sportswear","Shoes","Accessories","Knitwear","Shirts"];
const SIZES = ["XS","S","M","L","XL","XXL"];
const COLORS = ["Black","Navy","Grey","Green","Red","Blue","Beige","White","Multi"];
const CONDITIONS = ["New with tags","Excellent","Very good","Good","Fair"];
const SUPPLIERS = ["Charity Shop","Car Boot Sale","Facebook Marketplace","Vintage Wholesale UK","Auction House","Clearance Outlet"];
const LOCATIONS = ["Rail A","Rail B","Box 1","Box 2","Loft Storage","Under Bed"];
const STATUSES = ["Not Listed","Listed","Reserved","Sold","Returned","Dead Stock"];
const EXPENSE_CATS = ["Packaging","Postage","Stock","Travel","Storage","Cleaning","Repairs","Subscriptions","Advertising","Equipment","Other"];
const CHART_COLORS = ["#2F6F52","#C77B2C","#3D7A8A","#8A5A44","#6E8B3D","#B3462C","#5B6B9E","#9C7A2E"];

const ITEM_TYPES = {
  Fleeces: ["Fleece", "Half-zip fleece", "Retro fleece"],
  Jackets: ["Jacket", "Puffer jacket", "Windbreaker", "Shell jacket"],
  Hoodies: ["Hoodie", "Zip hoodie", "Pullover hoodie"],
  "T-Shirts": ["T-shirt", "Logo tee", "Graphic tee"],
  Jeans: ["Jeans", "Straight jeans", "Relaxed jeans"],
  Sportswear: ["Track top", "Joggers", "Training shorts"],
  Shoes: ["Trainers", "Boots", "Running shoes"],
  Accessories: ["Cap", "Beanie", "Bag", "Scarf"],
  Knitwear: ["Jumper", "Cardigan", "Knit sweater"],
  Shirts: ["Shirt", "Oxford shirt", "Check shirt"],
};

// "Active" = items you could still sell. "Stock" also includes dead stock, because that money is still tied up.
const ACTIVE_STATUSES = ["Not Listed", "Listed", "Reserved"];
const STOCK_STATUSES = ["Not Listed", "Listed", "Reserved", "Dead Stock"];
const STATUS_COLORS = {
  "Not Listed": "#9A9784", Listed: "#3D7A8A", Reserved: "#B98A1E",
  Sold: "#2F6F52", Returned: "#8A5A44", "Dead Stock": "#B3462C",
};

const STORAGE_KEYS = {
  items: "resellr_items_v1",
  sales: "resellr_sales_v1",
  expenses: "resellr_expenses_v1",
  goals: "resellr_goals_v1",
  settings: "resellr_settings_v1",
  lastBackup: "resellr_lastbackup_v1",
  onboarded: "resellr_onboarded_v1",
};

const DEFAULT_GOALS = { revenue: 1800, profit: 750, sales: 40, listings: 35 };
const DEFAULT_SETTINGS = {
  businessName: "RESELLR",
  roiBuyThreshold: 80,
  roiConsiderThreshold: 30,
  ageWarn1: 30,
  ageWarn2: 60,
  ageWarn3: 90,
};

/* ---------------------------------------------------------------------- */
/*  UTILITIES                                                              */
/* ---------------------------------------------------------------------- */

const money = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
const monthKey = (d) => (d || "").slice(0, 7);
const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
};
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function totalItemCost(item) {
  return (Number(item.purchaseCost) || 0) + (Number(item.cleaningCost) || 0) +
    (Number(item.repairCost) || 0) + (Number(item.otherCost) || 0);
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

/* ---- CSV import ---- */

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function toISODate(s) {
  const v = String(s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

const CSV_ALIASES = {
  name: ["name", "item", "itemname", "title"],
  brand: ["brand"],
  category: ["category", "type"],
  subcategory: ["subcategory"],
  size: ["size"],
  color: ["colour", "color"],
  condition: ["condition"],
  purchaseDate: ["purchasedate", "datebought", "dateofpurchase", "bought"],
  purchaseCost: ["purchasecost", "purchaseprice", "cost", "pricepaid", "paid"],
  cleaningCost: ["cleaningcost", "cleaning"],
  repairCost: ["repaircost", "repair", "repairs"],
  otherCost: ["othercost", "other"],
  supplier: ["supplier", "source"],
  location: ["storagelocation", "location"],
  listedDate: ["listeddate", "datelisted"],
  listingPrice: ["listingprice", "listprice", "askingprice", "price"],
  status: ["status"],
  notes: ["notes", "note"],
};

function parseInventoryCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { error: "That file has no data rows. Use the template: a heading row, then one row per item." };
  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const col = {};
  Object.entries(CSV_ALIASES).forEach(([field, names]) => {
    const idx = headers.findIndex((h) => names.includes(h));
    if (idx >= 0) col[field] = idx;
  });
  if (col.name === undefined) return { error: "Couldn't find a Name column. The first row needs headings like Name, Brand and PurchaseCost." };

  const get = (row, f) => (col[f] === undefined ? "" : String(row[col[f]] ?? "").trim());
  const num = (s) => {
    const n = parseFloat(String(s).replace(/[£,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const items = [];
  let skipped = 0;
  rows.slice(1).forEach((row) => {
    const name = get(row, "name");
    let status = STATUSES.find((s) => s.toLowerCase() === get(row, "status").toLowerCase());
    if (!name || status === "Sold") { skipped++; return; }
    const purchaseDate = toISODate(get(row, "purchaseDate")) || todayISO();
    const listedDate = toISODate(get(row, "listedDate"));
    if (!status) status = listedDate ? "Listed" : "Not Listed";
    items.push({
      id: uid("itm_"),
      name,
      brand: get(row, "brand") || "Unbranded",
      category: get(row, "category") || "Other",
      subcategory: get(row, "subcategory"),
      size: get(row, "size"),
      color: get(row, "color"),
      condition: get(row, "condition") || "Good",
      purchaseDate,
      purchaseCost: num(get(row, "purchaseCost")),
      cleaningCost: num(get(row, "cleaningCost")),
      repairCost: num(get(row, "repairCost")),
      otherCost: num(get(row, "otherCost")),
      supplier: get(row, "supplier") || "Unknown",
      location: get(row, "location"),
      listedDate: status === "Not Listed" ? "" : (listedDate || purchaseDate),
      listingPrice: num(get(row, "listingPrice")),
      status,
      notes: get(row, "notes"),
    });
  });
  if (!items.length) return { error: "No importable rows found. Each row needs a Name. Sold items can't be imported, so record those with the Sell button." };
  return { items, skipped };
}

const IMPORT_TEMPLATE = [
  { Name: "Nike Hoodie", Brand: "Nike", Category: "Hoodies", Size: "L", Condition: "Very good", PurchaseDate: "2026-11-01", PurchaseCost: 6.5, Supplier: "Charity Shop", ListedDate: "2026-11-02", ListingPrice: 24.99, Status: "Listed", Notes: "" },
  { Name: "Patagonia Fleece", Brand: "Patagonia", Category: "Fleeces", Size: "M", Condition: "Good", PurchaseDate: "2026-11-03", PurchaseCost: 12, Supplier: "Car Boot Sale", ListedDate: "", ListingPrice: 39.99, Status: "Not Listed", Notes: "Needs a wash" },
];

function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------- */
/*  DEMO DATA GENERATOR                                                    */
/* ---------------------------------------------------------------------- */

function generateDemoData() {
  const items = [];
  const sales = [];

  const pickStatus = () => {
    const r = Math.random();
    if (r < 0.56) return "Sold";
    if (r < 0.78) return "Listed";
    if (r < 0.86) return "Not Listed";
    if (r < 0.92) return "Reserved";
    if (r < 0.96) return "Dead Stock";
    return "Returned";
  };
  // How many days ago each kind of item was bought, so ages look believable.
  const ageRange = {
    "Sold": [10, 150], "Listed": [3, 75], "Not Listed": [1, 9],
    "Reserved": [6, 28], "Dead Stock": [100, 165], "Returned": [25, 90],
  };

  for (let i = 0; i < 34; i++) {
    const status = pickStatus();
    const brand = pick(BRANDS);
    const category = pick(CATEGORIES);
    const [lo, hi] = ageRange[status];
    const purchaseDaysAgo = Math.floor(rand(lo, hi));
    const purchaseCost = Number(rand(3, 26).toFixed(2));
    const cleaningCost = Math.random() < 0.3 ? Number(rand(1, 3.5).toFixed(2)) : 0;
    const repairCost = Math.random() < 0.1 ? Number(rand(2, 6).toFixed(2)) : 0;
    const cost = purchaseCost + cleaningCost + repairCost;
    const listingPrice = Number(Math.max(6.99, Math.round(cost * rand(1.9, 3.4)) - 0.01).toFixed(2));
    const listedDaysAgo = Math.max(0, purchaseDaysAgo - Math.floor(rand(0, 4)));
    const id = uid("demo_itm_");

    items.push({
      id,
      name: `${brand} ${pick(ITEM_TYPES[category])}`,
      brand, category, subcategory: "",
      size: pick(SIZES), color: pick(COLORS), condition: pick(CONDITIONS),
      purchaseDate: daysAgoISO(purchaseDaysAgo),
      purchaseCost, cleaningCost, repairCost, otherCost: 0,
      supplier: pick(SUPPLIERS), location: pick(LOCATIONS),
      listedDate: status === "Not Listed" ? "" : daysAgoISO(listedDaysAgo),
      listingPrice, status, notes: "",
    });

    if (status === "Sold") {
      const soldDaysAgo = Math.max(0, listedDaysAgo - Math.floor(rand(3, 45)));
      sales.push({
        id: uid("demo_sale_"),
        itemId: id,
        saleDate: daysAgoISO(soldDaysAgo),
        salePrice: Number((listingPrice * rand(0.82, 1)).toFixed(2)),
        additionalCosts: 0,
        packagingCost: Number(rand(0.2, 0.8).toFixed(2)),
        postageCost: Math.random() < 0.25 ? Number(rand(2.5, 4).toFixed(2)) : 0,
        platformFees: 0,
      });
    }
  }

  const expenseText = {
    Packaging: ["Mailing bags", "Tissue paper and tape", "Labels and printer ink"],
    Postage: ["Postage supplies", "Return postage"],
    Travel: ["Fuel for a sourcing trip", "Parking at a car boot"],
    Storage: ["Storage boxes", "Clothes rail"],
    Cleaning: ["Laundry and detergent", "Stain remover"],
    Repairs: ["Zip replacement", "Sewing supplies"],
    Subscriptions: ["Photo editing app"],
    Advertising: ["Vinted bump"],
    Equipment: ["Garment steamer", "Mannequin"],
    Other: ["Sundries"],
  };
  const expenses = [];
  for (let i = 0; i < 24; i++) {
    const category = pick(Object.keys(expenseText));
    expenses.push({
      id: uid("demo_exp_"),
      date: daysAgoISO(Math.floor(rand(0, 150))),
      category,
      description: pick(expenseText[category]),
      amount: Number(rand(3, 35).toFixed(2)),
      supplier: "",
      notes: "",
    });
  }

  return { items, sales, expenses };
}

/* ---------------------------------------------------------------------- */
/*  SMALL UI PRIMITIVES                                                    */
/* ---------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const map = {
    "Not Listed": "badge-grey",
    "Listed": "badge-blue",
    "Reserved": "badge-amber",
    "Sold": "badge-green",
    "Returned": "badge-red",
    "Dead Stock": "badge-red",
  };
  return <span className={`badge ${map[status] || "badge-grey"}`}>{status}</span>;
}

function RoiBadge({ value, settings }) {
  const v = Number(value) || 0;
  let cls = "badge-red";
  if (v >= settings.roiBuyThreshold) cls = "badge-green";
  else if (v >= settings.roiConsiderThreshold) cls = "badge-amber";
  return <span className={`badge ${cls}`}>{pct(v)}</span>;
}

function KpiCard({ label, value, sub, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub != null && (
        <div className={`kpi-trend ${trend === "up" ? "trend-up" : trend === "down" ? "trend-down" : ""}`}>
          {trend === "up" && <ArrowUpRight size={13} />}
          {trend === "down" && <ArrowDownRight size={13} />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

function Panel({ title, action, children, className = "" }) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}

function ProgressBar({ value, max, colorClass = "" }) {
  const p = clamp(max > 0 ? (value / max) * 100 : 0, 0, 100);
  return (
    <div className="progress-track">
      <div className={`progress-fill ${colorClass}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------------- */
/*  MAIN APP                                                               */
/* ---------------------------------------------------------------------- */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "sales", label: "Sales", icon: ShoppingBag },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "buypass", label: "Buy or Pass", icon: ClipboardCheck },
  { key: "pricing", label: "Pricing calculator", icon: Calculator },
  { key: "brands", label: "Brands", icon: Tags },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "monthly", label: "Monthly performance", icon: CalendarRange },
  { key: "goals", label: "Goals", icon: Target },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const [itemModal, setItemModal] = useState(null); // {mode:'add'|'edit', item}
  const [sellModal, setSellModal] = useState(null); // item to mark sold
  const [expenseModal, setExpenseModal] = useState(null);
  const [toast, setToast] = useState("");

  const skipSave = useRef(true);
  const [saveError, setSaveError] = useState(false);
  const [lastBackup, setLastBackup] = useState("");
  const [welcome, setWelcome] = useState(null); // null | "first" | "replay"
  const [viewItemId, setViewItemId] = useState(null);

  /* ---- load from localStorage on first mount ----
     Each buyer's data lives only in their own browser, under these keys.
     If you later add a real backend, this is the block to swap out. */
  useEffect(() => {
    let li = null, ls = null, le = null, lg = null, lst = null, lb = "";
    let seenWelcome = false;
    try { const v = localStorage.getItem(STORAGE_KEYS.items); li = v ? JSON.parse(v) : null; } catch (e) {}
    try { const v = localStorage.getItem(STORAGE_KEYS.sales); ls = v ? JSON.parse(v) : null; } catch (e) {}
    try { const v = localStorage.getItem(STORAGE_KEYS.expenses); le = v ? JSON.parse(v) : null; } catch (e) {}
    try { const v = localStorage.getItem(STORAGE_KEYS.goals); lg = v ? JSON.parse(v) : null; } catch (e) {}
    try { const v = localStorage.getItem(STORAGE_KEYS.settings); lst = v ? JSON.parse(v) : null; } catch (e) {}
    try { lb = localStorage.getItem(STORAGE_KEYS.lastBackup) || ""; } catch (e) {}
    try { seenWelcome = !!localStorage.getItem(STORAGE_KEYS.onboarded); } catch (e) {}

    const hasSaved = !!(li && ls && le);
    if (hasSaved) {
      setItems(li); setSales(ls); setExpenses(le);
    } else {
      const demo = generateDemoData();
      setItems(demo.items); setSales(demo.sales); setExpenses(demo.expenses);
      // Save the demo data straight away so a reload doesn't generate a different set.
      persist(STORAGE_KEYS.items, demo.items);
      persist(STORAGE_KEYS.sales, demo.sales);
      persist(STORAGE_KEYS.expenses, demo.expenses);
      if (!seenWelcome) setWelcome("first");
    }
    if (lg) setGoals({ ...DEFAULT_GOALS, ...lg });
    if (lst) setSettings({ ...DEFAULT_SETTINGS, ...lst });
    setLastBackup(lb);

    // Ask the browser not to evict this site's data when storage is tight.
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

    setLoaded(true);
    setTimeout(() => { skipSave.current = false; }, 0);
  }, []);

  /* ---- persist on change; warn if the browser refuses to save ---- */
  useEffect(() => { if (!skipSave.current && !persist(STORAGE_KEYS.items, items)) setSaveError(true); }, [items]);
  useEffect(() => { if (!skipSave.current && !persist(STORAGE_KEYS.sales, sales)) setSaveError(true); }, [sales]);
  useEffect(() => { if (!skipSave.current && !persist(STORAGE_KEYS.expenses, expenses)) setSaveError(true); }, [expenses]);
  useEffect(() => { if (!skipSave.current && !persist(STORAGE_KEYS.goals, goals)) setSaveError(true); }, [goals]);
  useEffect(() => { if (!skipSave.current && !persist(STORAGE_KEYS.settings, settings)) setSaveError(true); }, [settings]);

  function closeWelcome() {
    try { localStorage.setItem(STORAGE_KEYS.onboarded, "1"); } catch (e) {}
    setWelcome(null);
  }
  function startFresh() {
    setItems([]); setSales([]); setExpenses([]);
    closeWelcome();
    setPage("inventory");
    setItemModal({ mode: "add" });
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  /* ---- CRUD ---- */
  function saveItem(data) {
    if (data.id) {
      setItems((prev) => prev.map((it) => (it.id === data.id ? data : it)));
      showToast("Item updated");
    } else {
      setItems((prev) => [...prev, { ...data, id: uid("itm_") }]);
      showToast("Item added");
    }
    setItemModal(null);
  }
  function deleteItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSales((prev) => prev.filter((s) => s.itemId !== id));
    showToast("Item deleted");
  }
  function completeSale(itemId, saleData) {
    setSales((prev) => [...prev, { ...saleData, id: uid("sale_"), itemId }]);
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "Sold" } : it)));
    setSellModal(null);
    showToast("Sale recorded");
  }
  function deleteSale(saleId, itemId) {
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "Listed" } : it)));
    showToast("Sale removed");
  }
  function saveExpense(data) {
    if (data.id) setExpenses((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    else setExpenses((prev) => [...prev, { ...data, id: uid("exp_") }]);
    setExpenseModal(null);
    showToast("Expense saved");
  }
  function deleteExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    showToast("Expense deleted");
  }
  function clearDemoAndReset() {
    if (!window.confirm("This clears all items, sales and expenses and starts empty. Continue?")) return;
    setItems([]); setSales([]); setExpenses([]);
    showToast("Data cleared");
  }
  function reloadDemoData() {
    if (!window.confirm("This replaces current data with fresh demo data. Continue?")) return;
    const demo = generateDemoData();
    setItems(demo.items); setSales(demo.sales); setExpenses(demo.expenses);
    showToast("Demo data loaded");
  }

  /* ---- backup / restore (one JSON file with everything) ---- */
  function backupData() {
    const payload = {
      app: "resellr",
      version: 1,
      exportedAt: new Date().toISOString(),
      items, sales, expenses, goals, settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resellr-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const stamp = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEYS.lastBackup, stamp); } catch (e) {}
    setLastBackup(stamp);
    showToast("Backup downloaded");
  }

  function restoreData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.app !== "resellr" || !Array.isArray(data.items) || !Array.isArray(data.sales) || !Array.isArray(data.expenses)) {
          window.alert("That file isn't a RESELLR backup. Choose a file named like resellr-backup-2026-01-01.json.");
          return;
        }
        if (!window.confirm(`Restore this backup? It contains ${data.items.length} items, ${data.sales.length} sales and ${data.expenses.length} expenses, and replaces everything currently in the app.`)) return;
        setItems(data.items);
        setSales(data.sales);
        setExpenses(data.expenses);
        if (data.goals) setGoals({ ...DEFAULT_GOALS, ...data.goals });
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        showToast("Backup restored");
      } catch (e) {
        window.alert("Couldn't read that file. Make sure it's a RESELLR backup (.json) and try again.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------------------------------------------------------------------- */
  /*  DERIVED / COMPUTED DATA                                                */
  /* ---------------------------------------------------------------------- */

  const itemsById = useMemo(() => Object.fromEntries(items.map((it) => [it.id, it])), [items]);

  const itemsCalc = useMemo(() => items.map((it) => {
    const cost = totalItemCost(it);
    const isActive = ACTIVE_STATUSES.includes(it.status);
    const today = todayISO();
    const stockAge = daysBetween(it.purchaseDate, today);
    // Days listed only counts once an item has actually been listed.
    const daysListed = isActive && it.listedDate ? daysBetween(it.listedDate, today) : null;
    const price = Number(it.listingPrice) || 0;
    const potentialProfit = price - cost;
    const potentialROI = cost > 0 ? (potentialProfit / cost) * 100 : 0;
    return { ...it, totalCost: cost, isActive, stockAge, daysListed, potentialProfit, potentialROI };
  }), [items]);

  const salesCalc = useMemo(() => sales.map((s) => {
    const item = itemsById[s.itemId];
    const cost = item ? totalItemCost(item) : 0;
    const extra = (Number(s.additionalCosts) || 0) + (Number(s.packagingCost) || 0) + (Number(s.postageCost) || 0) + (Number(s.platformFees) || 0);
    const profit = (Number(s.salePrice) || 0) - cost - extra;
    const margin = s.salePrice > 0 ? (profit / s.salePrice) * 100 : 0;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    const daysToSell = item ? daysBetween(item.purchaseDate, s.saleDate) : 0;
    return { ...s, item, totalCost: cost, extra, profit, margin, roi, daysToSell };
  }), [sales, itemsById]);

  const activeStatuses = ACTIVE_STATUSES;
  const activeItems = useMemo(() => itemsCalc.filter((it) => ACTIVE_STATUSES.includes(it.status)), [itemsCalc]);
  const stockItems = useMemo(() => itemsCalc.filter((it) => STOCK_STATUSES.includes(it.status)), [itemsCalc]);

  const saleByItem = useMemo(() => {
    const m = {};
    salesCalc.forEach((s) => { m[s.itemId] = s; });
    return m;
  }, [salesCalc]);

  // Inventory rows show the real result for sold items and the potential result for the rest.
  const inventoryRows = useMemo(() => itemsCalc.map((it) => {
    const s = saleByItem[it.id] || null;
    return {
      ...it,
      sale: s,
      shownPrice: s ? Number(s.salePrice) || 0 : Number(it.listingPrice) || 0,
      shownProfit: s ? s.profit : it.potentialProfit,
      shownROI: s ? s.roi : it.potentialROI,
    };
  }), [itemsCalc, saleByItem]);

  const suggestions = useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      brands: uniq([...BRANDS, ...items.map((i) => i.brand)]),
      categories: uniq([...CATEGORIES, ...items.map((i) => i.category)]),
      suppliers: uniq([...SUPPLIERS, ...items.map((i) => i.supplier)]),
      locations: uniq([...LOCATIONS, ...items.map((i) => i.location)]),
      colors: uniq([...COLORS, ...items.map((i) => i.color)]),
      sizes: Array.from(new Set([...SIZES, ...items.map((i) => i.size).filter(Boolean)])),
    };
  }, [items]);

  const totals = useMemo(() => {
    const totalRevenue = salesCalc.reduce((a, s) => a + (Number(s.salePrice) || 0), 0);
    const totalProfit = salesCalc.reduce((a, s) => a + s.profit, 0);
    const totalExpenses = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    // Stock purchases are already counted in each item's cost, so leave them out to avoid counting twice.
    const overheadExpenses = expenses.filter((e) => e.category !== "Stock").reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const itemsSold = salesCalc.length;
    const avgSalePrice = itemsSold ? totalRevenue / itemsSold : 0;
    const avgProfit = itemsSold ? totalProfit / itemsSold : 0;
    const avgROI = itemsSold ? salesCalc.reduce((a, s) => a + s.roi, 0) / itemsSold : 0;
    const stockValue = stockItems.reduce((a, it) => a + it.totalCost, 0);
    const stockPotentialValue = stockItems.reduce((a, it) => a + (Number(it.listingPrice) || 0), 0);
    const activeCount = activeItems.length;
    const sellThrough = (itemsSold + activeCount) > 0 ? (itemsSold / (itemsSold + activeCount)) * 100 : 0;
    return {
      totalRevenue, totalProfit, totalExpenses, overheadExpenses, netProfit: totalProfit - overheadExpenses,
      itemsSold, avgSalePrice, avgProfit, avgROI, stockValue, stockPotentialValue, activeCount, sellThrough,
    };
  }, [salesCalc, activeItems, stockItems, expenses]);

  // Money tied up in stock, and how old it is (age counts from the purchase date).
  const stockInfo = useMemo(() => {
    const { ageWarn1: a1, ageWarn2: a2, ageWarn3: a3 } = settings;
    const sum = (list) => list.reduce((a, it) => a + it.totalCost, 0);
    const priced = stockItems.filter((it) => (Number(it.listingPrice) || 0) > 0);
    return {
      invested: sum(stockItems),
      potentialValue: priced.reduce((a, it) => a + (Number(it.listingPrice) || 0), 0),
      potentialProfit: priced.reduce((a, it) => a + it.potentialProfit, 0),
      over1: sum(stockItems.filter((it) => it.stockAge >= a1)),
      over2: sum(stockItems.filter((it) => it.stockAge >= a2)),
      over3: sum(stockItems.filter((it) => it.stockAge >= a3)),
      buckets: [
        { name: `Under ${a1}d`, value: sum(stockItems.filter((it) => it.stockAge < a1)) },
        { name: `${a1}-${a2 - 1}d`, value: sum(stockItems.filter((it) => it.stockAge >= a1 && it.stockAge < a2)) },
        { name: `${a2}-${a3 - 1}d`, value: sum(stockItems.filter((it) => it.stockAge >= a2 && it.stockAge < a3)) },
        { name: `${a3}d+`, value: sum(stockItems.filter((it) => it.stockAge >= a3)) },
      ].map((b) => ({ ...b, value: Number(b.value.toFixed(2)) })),
    };
  }, [stockItems, settings]);

  const statusData = useMemo(
    () => STATUSES.map((s) => ({ name: s, value: itemsCalc.filter((it) => it.status === s).length })).filter((d) => d.value > 0),
    [itemsCalc]
  );

  const monthlyStats = useMemo(() => {
    const map = {};
    salesCalc.forEach((s) => {
      const k = monthKey(s.saleDate);
      if (!k) return;
      if (!map[k]) map[k] = { key: k, revenue: 0, profit: 0, sales: 0, roiSum: 0 };
      map[k].revenue += Number(s.salePrice) || 0;
      map[k].profit += s.profit;
      map[k].sales += 1;
      map[k].roiSum += s.roi;
    });
    items.forEach((it) => {
      const ensure = (k) => {
        if (!map[k]) map[k] = { key: k, revenue: 0, profit: 0, sales: 0, roiSum: 0, spend: 0, listings: 0 };
        return map[k];
      };
      // Stock spend counts in the month an item was bought; listings count in the month it was listed.
      const pk = monthKey(it.purchaseDate);
      if (pk) { const m = ensure(pk); m.spend = (m.spend || 0) + totalItemCost(it); }
      const lk = monthKey(it.listedDate);
      if (lk) { const m = ensure(lk); m.listings = (m.listings || 0) + 1; }
    });
    expenses.forEach((e) => {
      const k = monthKey(e.date);
      if (!k) return;
      if (!map[k]) map[k] = { key: k, revenue: 0, profit: 0, sales: 0, roiSum: 0 };
      map[k].expenses = (map[k].expenses || 0) + (Number(e.amount) || 0);
    });
    const list = Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    return list.map((m) => ({
      ...m,
      avgSalePrice: m.sales ? m.revenue / m.sales : 0,
      avgROI: m.sales ? m.roiSum / m.sales : 0,
    }));
  }, [salesCalc, items, expenses]);

  const thisMonthKey = monthKey(todayISO());
  const last6Months = monthlyStats.slice(-6);
  const thisMonth = monthlyStats.find((m) => m.key === thisMonthKey) || { revenue: 0, profit: 0, sales: 0, listings: 0 };
  const prevMonthKey = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const prevMonth = monthlyStats.find((m) => m.key === prevMonthKey) || { revenue: 0, profit: 0, sales: 0 };
  const changePct = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0);

  function groupStats(keyFn) {
    const map = {};
    itemsCalc.forEach((it) => {
      const k = keyFn(it);
      if (!k) return;
      if (!map[k]) map[k] = { key: k, bought: 0, spend: 0, sold: 0, revenue: 0, profit: 0, roiSum: 0, daysSum: 0, active: 0 };
      map[k].bought += 1;
      map[k].spend += it.totalCost;
      if (activeStatuses.includes(it.status)) map[k].active += 1;
    });
    salesCalc.forEach((s) => {
      if (!s.item) return;
      const k = keyFn(s.item);
      if (!k || !map[k]) return;
      map[k].sold += 1;
      map[k].revenue += Number(s.salePrice) || 0;
      map[k].profit += s.profit;
      map[k].roiSum += s.roi;
      map[k].daysSum += s.daysToSell;
    });
    return Object.values(map).map((g) => ({
      ...g,
      avgSalePrice: g.sold ? g.revenue / g.sold : 0,
      avgProfit: g.sold ? g.profit / g.sold : 0,
      avgROI: g.sold ? g.roiSum / g.sold : 0,
      avgDaysToSell: g.sold ? g.daysSum / g.sold : 0,
      sellThrough: (g.sold + g.active) > 0 ? (g.sold / (g.sold + g.active)) * 100 : 0,
    }));
  }

  const brandStats = useMemo(() => groupStats((it) => it.brand).sort((a, b) => b.profit - a.profit), [itemsCalc, salesCalc]);
  const categoryStats = useMemo(() => groupStats((it) => it.category).sort((a, b) => b.profit - a.profit), [itemsCalc, salesCalc]);
  const supplierStats = useMemo(() => groupStats((it) => it.supplier).sort((a, b) => b.profit - a.profit), [itemsCalc, salesCalc]);

  const attentionItems = useMemo(() => {
    const list = [];
    itemsCalc.forEach((it) => {
      if (!STOCK_STATUSES.includes(it.status)) return;
      const reasons = [];
      if (it.status === "Dead Stock") reasons.push("Marked as dead stock");
      if (it.daysListed != null) {
        if (it.daysListed >= settings.ageWarn3) reasons.push(`Listed ${it.daysListed} days, so cut the price`);
        else if (it.daysListed >= settings.ageWarn2) reasons.push(`Listed ${it.daysListed} days, consider a price drop`);
        else if (it.daysListed >= settings.ageWarn1) reasons.push(`Listed ${it.daysListed} days`);
      }
      if (it.status === "Not Listed" && it.stockAge >= 14) reasons.push(`In stock ${it.stockAge} days and not listed yet`);
      if (it.isActive && it.listingPrice > 0 && it.potentialROI < settings.roiConsiderThreshold) reasons.push(`Low margin (${pct(it.potentialROI)} ROI)`);
      if (reasons.length) list.push({ ...it, reasons });
    });
    return list.sort((a, b) => b.reasons.length - a.reasons.length || (b.daysListed ?? b.stockAge) - (a.daysListed ?? a.stockAge));
  }, [itemsCalc, settings]);

  const businessHealth = useMemo(() => {
    const avgMargin = totals.itemsSold ? salesCalc.reduce((a, s) => a + s.margin, 0) / totals.itemsSold : 0;
    const marginScore = clamp((avgMargin / 40) * 100, 0, 100) * 0.25;
    const roiScore = clamp(totals.avgROI, 0, 100) * 0.25;
    const sellScore = clamp((totals.sellThrough / 65) * 100, 0, 100) * 0.2;
    const agedRatio = stockInfo.invested > 0 ? stockInfo.over3 / stockInfo.invested : 0;
    const agedScore = clamp((1 - agedRatio) * 100, 0, 100) * 0.15;
    const goalScore = clamp((thisMonth.profit / (goals.profit || 1)) * 100, 0, 100) * 0.15;
    const score = Math.round(marginScore + roiScore + sellScore + agedScore + goalScore);
    let label = "Needs attention", cls = "health-red";
    if (score >= 85) { label = "Excellent"; cls = "health-green"; }
    else if (score >= 70) { label = "Very good"; cls = "health-green"; }
    else if (score >= 55) { label = "Good"; cls = "health-amber"; }
    else if (score >= 40) { label = "Fair"; cls = "health-amber"; }
    return { score: clamp(score, 0, 100), label, cls, avgMargin };
  }, [totals, salesCalc, stockInfo, thisMonth, goals]);

  // Show the backup reminder only once there is real (non-demo) data worth protecting.
  const hasOwnData = useMemo(
    () => [...items, ...sales, ...expenses].some((r) => !String(r.id).startsWith("demo_")),
    [items, sales, expenses]
  );
  const daysSinceBackup = lastBackup ? daysBetween(lastBackup.slice(0, 10), todayISO()) : null;
  const backupNeeded = hasOwnData && (daysSinceBackup === null || daysSinceBackup >= 14);

  const categoryPie = useMemo(() => categoryStats.filter((c) => c.revenue > 0).map((c) => ({ name: c.key, value: Number(c.revenue.toFixed(2)) })), [categoryStats]);

  /* ---------------------------------------------------------------------- */

  if (!loaded) {
    return <div className="loading-screen">Loading your business data…</div>;
  }

  const currentNav = NAV.find((n) => n.key === page);
  const viewedItem = viewItemId ? inventoryRows.find((r) => r.id === viewItemId) : null;

  function importItems(newItems, skipped) {
    setItems((prev) => [...prev, ...newItems]);
    showToast(`Imported ${newItems.length} item${newItems.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}`);
  }

  return (
    <div className="app">
      <style>{STYLES}</style>

      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">{settings.businessName || "RESELLR"}</div>
            <div className="brand-sub">Command centre</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                className={`nav-item ${page === n.key ? "nav-active" : ""}`}
                onClick={() => { setPage(n.key); setNavOpen(false); }}
              >
                <Icon size={17} />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="foot-title"><ShieldCheck size={14} /> Saved on this device</div>
          <div className="foot-sub">{lastBackup ? `Last backup ${fmtDate(lastBackup)}` : "No backup yet"}</div>
          <button className="foot-btn" onClick={() => { setPage("settings"); setNavOpen(false); }}>Back up your data</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" aria-label="Open menu" onClick={() => setNavOpen((v) => !v)}><Menu size={20} /></button>
          <h1>{currentNav?.label}</h1>
          <div className="topbar-health">
            <span className={`health-pill ${businessHealth.cls}`}>Health {businessHealth.score}/100</span>
          </div>
        </header>

        {saveError && (
          <div className="banner banner-red banner-top">
            <AlertTriangle size={18} />
            <div><strong>Your latest changes couldn't be saved.</strong> Your browser may be blocking storage (private browsing, or storage full). Download a backup now so nothing is lost.</div>
            <button className="btn-primary" onClick={backupData}>Download backup</button>
          </div>
        )}

        <main className="content">
          {page === "dashboard" && (
            <DashboardPage
              totals={totals} settings={settings} goals={goals} thisMonth={thisMonth} prevMonth={prevMonth}
              changePct={changePct} last6Months={last6Months} brandStats={brandStats} categoryPie={categoryPie}
              stockInfo={stockInfo} statusData={statusData} businessHealth={businessHealth}
              attentionItems={attentionItems} salesCalc={salesCalc} setPage={setPage}
              backupNeeded={backupNeeded} onBackup={backupData}
              onViewItem={(id) => setViewItemId(id)}
            />
          )}
          {page === "inventory" && (
            <InventoryPage
              rows={inventoryRows} settings={settings}
              onAdd={() => setItemModal({ mode: "add" })}
              onEdit={(it) => setItemModal({ mode: "edit", item: it })}
              onDelete={deleteItem}
              onSell={(it) => setSellModal(it)}
              onView={(it) => setViewItemId(it.id)}
              onImport={importItems}
              onExport={() => downloadCSV("inventory.csv", inventoryRows.map((it) => ({
                Name: it.name, Brand: it.brand, Category: it.category, Subcategory: it.subcategory, Size: it.size,
                Colour: it.color, Condition: it.condition, PurchaseDate: it.purchaseDate, PurchaseCost: it.purchaseCost,
                CleaningCost: it.cleaningCost, RepairCost: it.repairCost, OtherCost: it.otherCost, Supplier: it.supplier,
                StorageLocation: it.location, ListedDate: it.listedDate, ListingPrice: it.listingPrice, Status: it.status,
                Notes: it.notes, TotalCost: it.totalCost.toFixed(2), PotentialProfit: it.potentialProfit.toFixed(2),
                PotentialROI: it.potentialROI.toFixed(1),
              })))}
            />
          )}
          {page === "sales" && (
            <SalesPage
              salesCalc={salesCalc} settings={settings} onDelete={deleteSale}
              onExport={() => downloadCSV("sales.csv", salesCalc.map((s) => ({
                ItemName: s.item?.name || "(deleted item)", Brand: s.item?.brand || "", SaleDate: s.saleDate,
                SalePrice: s.salePrice, TotalCost: s.totalCost.toFixed(2), ExtraCosts: s.extra.toFixed(2),
                Profit: s.profit.toFixed(2), MarginPct: s.margin.toFixed(1), RoiPct: s.roi.toFixed(1), DaysToSell: s.daysToSell,
              })))}
            />
          )}
          {page === "expenses" && (
            <ExpensesPage
              expenses={expenses}
              onAdd={() => setExpenseModal({ mode: "add" })}
              onEdit={(e) => setExpenseModal({ mode: "edit", expense: e })}
              onDelete={deleteExpense}
              onExport={() => downloadCSV("expenses.csv", expenses)}
            />
          )}
          {page === "buypass" && <BuyPassPage settings={settings} />}
          {page === "pricing" && <PricingCalculatorPage />}
          {page === "brands" && <RankPage title="Brand performance" stats={brandStats} settings={settings} />}
          {page === "suppliers" && <RankPage title="Supplier performance" stats={supplierStats} settings={settings} isSupplier />}
          {page === "monthly" && <MonthlyPage monthlyStats={monthlyStats} thisMonth={thisMonth} prevMonth={prevMonth} changePct={changePct} />}
          {page === "goals" && <GoalsPage goals={goals} setGoals={setGoals} thisMonth={thisMonth} totals={totals} />}
          {page === "settings" && (
            <SettingsPage
              settings={settings} setSettings={setSettings} lastBackup={lastBackup}
              onClear={clearDemoAndReset} onReload={reloadDemoData}
              onBackup={backupData} onRestore={restoreData}
              onWelcome={() => setWelcome("replay")}
              onExportAll={() => {
                downloadCSV("inventory.csv", itemsCalc);
                downloadCSV("sales.csv", salesCalc.map(({ item, ...s }) => s));
                downloadCSV("expenses.csv", expenses);
              }}
            />
          )}
        </main>
      </div>

      {itemModal && (
        <ItemModal
          initial={itemModal.item}
          suggestions={suggestions}
          onClose={() => setItemModal(null)}
          onSave={saveItem}
        />
      )}
      {sellModal && (
        <SellModal
          item={sellModal}
          onClose={() => setSellModal(null)}
          onConfirm={(saleData) => completeSale(sellModal.id, saleData)}
        />
      )}
      {expenseModal && (
        <ExpenseModal
          initial={expenseModal.expense}
          onClose={() => setExpenseModal(null)}
          onSave={saveExpense}
        />
      )}
      {viewedItem && (
        <ItemDetailModal
          item={viewedItem}
          settings={settings}
          onClose={() => setViewItemId(null)}
          onEdit={() => { setViewItemId(null); setItemModal({ mode: "edit", item: viewedItem }); }}
          onSell={() => { setViewItemId(null); setSellModal(viewedItem); }}
          onDelete={() => { if (window.confirm("Delete this item?")) { deleteItem(viewedItem.id); setViewItemId(null); } }}
        />
      )}
      {welcome && (
        <WelcomeModal
          mode={welcome}
          onExplore={closeWelcome}
          onStartFresh={startFresh}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DASHBOARD                                                              */
/* ---------------------------------------------------------------------- */

const TOOLTIP_STYLE = { background: "#fff", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 };

function DashboardPage({
  totals, settings, goals, thisMonth, prevMonth, changePct, last6Months, brandStats, categoryPie,
  stockInfo, statusData, businessHealth, attentionItems, salesCalc, setPage, backupNeeded, onBackup, onViewItem,
}) {
  const revChange = changePct(thisMonth.revenue, prevMonth.revenue);
  const topBrands = brandStats.filter((b) => b.sold > 0).slice(0, 6).map((b) => ({ name: b.key, Profit: Number(b.profit.toFixed(2)) }));
  const recentSales = [...salesCalc].sort((a, b) => (b.saleDate || "").localeCompare(a.saleDate || "")).slice(0, 6);
  const isEmpty = totals.itemsSold === 0 && totals.activeCount === 0;

  const tips = [];
  if (totals.itemsSold > 0 && businessHealth.avgMargin < 40) tips.push(`Average margin is ${pct(businessHealth.avgMargin)}. Aim for 40%+ by sourcing lower and pricing firmer.`);
  if (totals.sellThrough < 65 && !isEmpty) tips.push(`Sell-through is ${pct(totals.sellThrough)}. List faster, or cut prices on slow stock.`);
  if (stockInfo.over3 > 0) tips.push(`${money(stockInfo.over3)} is tied up in stock bought ${settings.ageWarn3}+ days ago. Consider a price drop.`);
  if (goals.profit > 0 && thisMonth.profit < goals.profit) tips.push(`${money(goals.profit - thisMonth.profit)} short of this month's profit goal.`);
  if (tips.length === 0) tips.push("Nothing is dragging your score down. Keep listing and keep sourcing well.");

  return (
    <div className="stack">
      {backupNeeded && (
        <div className="banner">
          <ShieldCheck size={18} />
          <div><strong>Back up your data.</strong> It's stored only in this browser, so a backup file keeps it safe if you clear your browser data or switch device.</div>
          <button className="btn-primary" onClick={onBackup}>Download backup</button>
        </div>
      )}

      {isEmpty && (
        <Panel title="Start here">
          <p className="muted-text" style={{ marginBottom: 12 }}>Your dashboard fills in as you add stock and record sales. Add your first item to get started.</p>
          <button className="btn-primary" onClick={() => setPage("inventory")}><Plus size={15} /> Go to Inventory</button>
        </Panel>
      )}

      <div className="kpi-grid">
        <KpiCard label="Total revenue" value={money(totals.totalRevenue)} sub={`${revChange >= 0 ? "+" : ""}${revChange.toFixed(0)}% vs last month`} trend={revChange >= 0 ? "up" : "down"} />
        <KpiCard label="Total profit" value={money(totals.totalProfit)} sub={`${money(totals.netProfit)} after expenses`} />
        <KpiCard label="Active stock" value={totals.activeCount} sub="items you can still sell" />
        <KpiCard label="Money in stock" value={money(totals.stockValue)} sub={`${money(totals.stockPotentialValue)} potential resale`} />
        <KpiCard label="Items sold" value={totals.itemsSold} />
        <KpiCard label="Avg sale price" value={money(totals.avgSalePrice)} />
        <KpiCard label="Avg profit / sale" value={money(totals.avgProfit)} />
        <KpiCard label="Avg ROI" value={pct(totals.avgROI)} />
        <KpiCard label="Sell-through rate" value={pct(totals.sellThrough)} />
        <KpiCard label="This month's profit" value={money(thisMonth.profit)} sub={`Goal ${money(goals.profit)}`} />
      </div>

      <div className="grid-2">
        <Panel title="Revenue and profit, last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={last6Months.map((m) => ({ month: monthLabel(m.key), Revenue: Number(m.revenue.toFixed(2)), Profit: Number(m.profit.toFixed(2)) }))}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="var(--ink-soft)" fontSize={12} />
              <YAxis stroke="var(--ink-soft)" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#3D7A8A" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Profit" stroke="#2F6F52" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Business health">
          <div className="health-block">
            <div className={`health-score ${businessHealth.cls}`}>{businessHealth.score}</div>
            <div className="health-label">out of 100: {businessHealth.label}</div>
          </div>
          <ul className="health-tips">
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Panel>
      </div>

      <Panel title="Items needing attention" action={<span className="muted-count">{attentionItems.length}</span>}>
        {attentionItems.length === 0 ? (
          <div className="empty-state"><CheckCircle2 size={18} /> Nothing needs attention right now.</div>
        ) : (
          <div className="table-scroll">
            <table className="table compact">
              <thead><tr><th>Item</th><th>Why</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {attentionItems.slice(0, 8).map((it) => (
                  <tr key={it.id} className="clickable" onClick={() => onViewItem(it.id)}>
                    <td><div className="cell-main">{it.name}</div><div className="cell-sub">{[it.brand, it.size].filter(Boolean).join(", ")}</div></td>
                    <td>{it.reasons.map((r, i) => <div key={i} className="reason">{r}</div>)}</td>
                    <td>{money(it.listingPrice)}</td>
                    <td><StatusBadge status={it.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="link-btn" onClick={() => setPage("inventory")}>View full inventory</button>
      </Panel>

      <div className="grid-2">
        <Panel title="Money tied up in stock">
          <div className="calc-rows">
            <div><span>Invested in stock</span><strong>{money(stockInfo.invested)}</strong></div>
            <div><span>Potential resale value</span><strong>{money(stockInfo.potentialValue)}</strong></div>
            <div><span>Potential profit</span><strong className={stockInfo.potentialProfit >= 0 ? "text-green" : "text-red"}>{money(stockInfo.potentialProfit)}</strong></div>
            <div><span>Bought {settings.ageWarn1}+ days ago</span><strong>{money(stockInfo.over1)}</strong></div>
            <div><span>Bought {settings.ageWarn2}+ days ago</span><strong>{money(stockInfo.over2)}</strong></div>
            <div><span>Bought {settings.ageWarn3}+ days ago</span><strong>{money(stockInfo.over3)}</strong></div>
          </div>
        </Panel>
        <Panel title="Stock age, by what you paid">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stockInfo.buckets}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--ink-soft)" fontSize={12} />
              <YAxis stroke="var(--ink-soft)" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Bar dataKey="value" name="Cost" fill="#C77B2C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Top brands by profit">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topBrands} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--ink-soft)" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="var(--ink-soft)" fontSize={12} width={100} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Bar dataKey="Profit" fill="#2F6F52" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Revenue share by category">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {categoryPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Inventory status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Recent sales">
          <div className="table-scroll">
            <table className="table compact">
              <thead><tr><th>Item</th><th>Date</th><th>Price</th><th>Profit</th></tr></thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id}>
                    <td><div className="cell-main">{s.item?.name || "(deleted)"}</div><div className="cell-sub">{s.item?.brand}</div></td>
                    <td>{s.saleDate}</td>
                    <td>{money(s.salePrice)}</td>
                    <td className={s.profit >= 0 ? "text-green" : "text-red"}>{money(s.profit)}</td>
                  </tr>
                ))}
                {recentSales.length === 0 && <tr><td colSpan={4} className="empty-cell">No sales yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  INVENTORY                                                              */
/* ---------------------------------------------------------------------- */

function ageText(it) {
  if (!it.isActive) return { main: "—", sub: "" };
  if (it.daysListed != null) return { main: `${it.daysListed}d`, sub: "listed" };
  return { main: `${it.stockAge}d`, sub: "in stock" };
}

function rowTone(it, settings) {
  if (it.status === "Dead Stock") return "row-danger";
  if (it.daysListed != null && it.daysListed >= settings.ageWarn3) return "row-danger";
  if (it.daysListed != null && it.daysListed >= settings.ageWarn1) return "row-warn";
  if (it.status === "Not Listed" && it.stockAge >= 14) return "row-warn";
  return "";
}

function InventoryPage({ rows, settings, onAdd, onEdit, onDelete, onSell, onView, onImport, onExport }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [supplier, setSupplier] = useState("All");
  const [size, setSize] = useState("All");
  const [age, setAge] = useState("All");
  const [sortBy, setSortBy] = useState("purchaseDate");
  const [sortDir, setSortDir] = useState("desc");
  const fileInput = useRef(null);

  const options = useMemo(() => {
    const uniq = (f) => Array.from(new Set(rows.map(f).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { brands: uniq((r) => r.brand), categories: uniq((r) => r.category), suppliers: uniq((r) => r.supplier), sizes: uniq((r) => r.size) };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((it) => {
      if (status !== "All" && it.status !== status) return false;
      if (brand !== "All" && it.brand !== brand) return false;
      if (category !== "All" && it.category !== category) return false;
      if (supplier !== "All" && it.supplier !== supplier) return false;
      if (size !== "All" && it.size !== size) return false;
      if (age !== "All") {
        const a = it.isActive ? (it.daysListed ?? it.stockAge) : -1;
        if (a < Number(age)) return false;
      }
      if (needle && !`${it.name} ${it.brand} ${it.category} ${it.supplier} ${it.size} ${it.color} ${it.notes}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const val = (it) => {
      const v = sortBy === "age" ? (it.isActive ? (it.daysListed ?? it.stockAge) : -1) : it[sortBy];
      return v == null ? -1 : v;
    };
    list.sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, q, status, brand, category, supplier, size, age, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir(col === "name" || col === "brand" ? "asc" : "desc"); }
  }
  const arrow = (col) => (sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const filtersOn = status !== "All" || brand !== "All" || category !== "All" || supplier !== "All" || size !== "All" || age !== "All" || q;
  function clearFilters() { setQ(""); setStatus("All"); setBrand("All"); setCategory("All"); setSupplier("All"); setSize("All"); setAge("All"); }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseInventoryCSV(String(reader.result));
      if (result.error) { window.alert(result.error); return; }
      const n = result.items.length;
      if (!window.confirm(`Import ${n} item${n === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} row${result.skipped === 1 ? "" : "s"} will be skipped)` : ""}?`)) return;
      onImport(result.items, result.skipped);
    };
    reader.readAsText(file);
  }

  function confirmDelete(it) {
    if (window.confirm(`Delete "${it.name}"?${it.sale ? " Its sale record will be removed too." : ""}`)) onDelete(it.id);
  }

  const Actions = ({ it }) => (
    <>
      {it.status !== "Sold" && (
        <button className="btn-mini" onClick={(e) => { e.stopPropagation(); onSell(it); }}><PackageCheck size={14} /> Sell</button>
      )}
      <button className="icon-btn" title="Edit" aria-label={`Edit ${it.name}`} onClick={(e) => { e.stopPropagation(); onEdit(it); }}><Pencil size={15} /></button>
      <button className="icon-btn" title="Delete" aria-label={`Delete ${it.name}`} onClick={(e) => { e.stopPropagation(); confirmDelete(it); }}><Trash2 size={15} /></button>
    </>
  );

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Search name, brand, category, supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="spacer" />
        <button className="btn-ghost" onClick={() => downloadCSV("resellr-import-template.csv", IMPORT_TEMPLATE)}>Import template</button>
        <button className="btn-ghost" onClick={() => fileInput.current && fileInput.current.click()}><Upload size={15} /> Import CSV</button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleFile} />
        <button className="btn-ghost" onClick={onExport}><Download size={15} /> Export CSV</button>
        <button className="btn-primary" onClick={onAdd}><Plus size={15} /> Add item</button>
      </div>

      <div className="filters">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="All">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="All">All brands</option>
          {options.brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All categories</option>
          {options.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          <option value="All">All suppliers</option>
          {options.suppliers.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="All">All sizes</option>
          {options.sizes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Age" value={age} onChange={(e) => setAge(e.target.value)}>
          <option value="All">Any age</option>
          <option value={settings.ageWarn1}>{settings.ageWarn1}+ days</option>
          <option value={settings.ageWarn2}>{settings.ageWarn2}+ days</option>
          <option value={settings.ageWarn3}>{settings.ageWarn3}+ days</option>
        </select>
        {filtersOn && <button className="link-btn" style={{ padding: 0 }} onClick={clearFilters}>Clear filters</button>}
        <span className="filter-count">{filtered.length} of {rows.length} items</span>
      </div>

      <Panel className="only-desktop">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("name")} className="sortable">Item{arrow("name")}</th>
                <th onClick={() => toggleSort("totalCost")} className="sortable">Cost{arrow("totalCost")}</th>
                <th onClick={() => toggleSort("shownPrice")} className="sortable">Price{arrow("shownPrice")}</th>
                <th onClick={() => toggleSort("shownProfit")} className="sortable">Profit{arrow("shownProfit")}</th>
                <th onClick={() => toggleSort("shownROI")} className="sortable">ROI{arrow("shownROI")}</th>
                <th onClick={() => toggleSort("age")} className="sortable">Age{arrow("age")}</th>
                <th onClick={() => toggleSort("status")} className="sortable">Status{arrow("status")}</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const a = ageText(it);
                return (
                  <tr key={it.id} className={`clickable ${rowTone(it, settings)}`} onClick={() => onView(it)}>
                    <td>
                      <div className="cell-main">{it.name}</div>
                      <div className="cell-sub">{[it.brand, it.category, it.size].filter(Boolean).join(", ")}</div>
                    </td>
                    <td>{money(it.totalCost)}</td>
                    <td>{money(it.shownPrice)}{it.sale && <div className="cell-sub">sold</div>}{!it.sale && <div className="cell-sub">asking</div>}</td>
                    <td className={it.shownProfit >= 0 ? "text-green" : "text-red"}>{money(it.shownProfit)}</td>
                    <td><RoiBadge value={it.shownROI} settings={settings} /></td>
                    <td>{a.main}{a.sub && <div className="cell-sub">{a.sub}</div>}</td>
                    <td><StatusBadge status={it.status} /></td>
                    <td className="col-actions"><div className="row-actions"><Actions it={it} /></div></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="empty-cell">{rows.length === 0 ? "No items yet. Tap Add item to log your first one." : "No items match your filters."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="inv-cards">
        {filtered.map((it) => {
          const a = ageText(it);
          return (
            <div key={it.id} className={`inv-card ${rowTone(it, settings)}`} onClick={() => onView(it)}>
              <div className="inv-card-top">
                <div>
                  <div className="cell-main">{it.name}</div>
                  <div className="cell-sub">{[it.brand, it.category, it.size].filter(Boolean).join(", ")}</div>
                </div>
                <StatusBadge status={it.status} />
              </div>
              <div className="inv-card-nums">
                <div><div className="num-label">Cost</div>{money(it.totalCost)}</div>
                <div><div className="num-label">{it.sale ? "Sold for" : "Asking"}</div>{money(it.shownPrice)}</div>
                <div><div className="num-label">Profit</div><span className={it.shownProfit >= 0 ? "text-green" : "text-red"}>{money(it.shownProfit)}</span></div>
                <div><div className="num-label">ROI</div><RoiBadge value={it.shownROI} settings={settings} /></div>
                <div><div className="num-label">Age</div>{a.main}{a.sub ? ` ${a.sub}` : ""}</div>
              </div>
              <div className="inv-card-actions"><Actions it={it} /></div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="empty-cell">{rows.length === 0 ? "No items yet. Tap Add item to log your first one." : "No items match your filters."}</div>}
      </div>
    </div>
  );
}

const ITEM_FIELDS = [
  "id", "name", "brand", "category", "subcategory", "size", "color", "condition", "purchaseDate",
  "purchaseCost", "cleaningCost", "repairCost", "otherCost", "supplier", "location", "listedDate",
  "listingPrice", "status", "notes",
];

function ItemModal({ initial, suggestions, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      const f = {};
      ITEM_FIELDS.forEach((k) => { f[k] = initial[k] ?? ""; });
      return f;
    }
    return {
      name: "", brand: "", category: "", subcategory: "", size: "", color: "", condition: CONDITIONS[1],
      purchaseDate: todayISO(), purchaseCost: "", cleaningCost: "", repairCost: "", otherCost: "",
      supplier: "", location: "", listedDate: "", listingPrice: "", status: "Not Listed", notes: "",
    };
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isSold = initial && initial.status === "Sold";

  const cost = totalItemCost(form);
  const price = Number(form.listingPrice) || 0;
  const profit = price - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;

  function submit() {
    if (!String(form.name).trim()) { setError("Give the item a name."); return; }
    if (form.purchaseCost === "" || Number.isNaN(Number(form.purchaseCost)) || Number(form.purchaseCost) < 0) {
      setError("Enter what you paid. Use 0 if it was free."); return;
    }
    let listedDate = form.listedDate;
    if (form.status === "Not Listed") listedDate = "";
    else if (!listedDate) listedDate = todayISO();
    const data = {};
    ITEM_FIELDS.forEach((k) => { data[k] = form[k]; });
    onSave({
      ...data,
      id: initial?.id,
      name: String(form.name).trim(),
      brand: String(form.brand).trim() || "Unbranded",
      category: String(form.category).trim() || "Other",
      supplier: String(form.supplier).trim() || "Unknown",
      listedDate,
      purchaseCost: Number(form.purchaseCost) || 0,
      cleaningCost: Number(form.cleaningCost) || 0,
      repairCost: Number(form.repairCost) || 0,
      otherCost: Number(form.otherCost) || 0,
      listingPrice: Number(form.listingPrice) || 0,
    });
  }

  return (
    <Modal title={initial ? "Edit item" : "Add item"} onClose={onClose} wide>
      <datalist id="dl-brands">{suggestions.brands.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-categories">{suggestions.categories.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-suppliers">{suggestions.suppliers.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-locations">{suggestions.locations.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-colors">{suggestions.colors.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-sizes">{suggestions.sizes.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="form-grid">
        <div className="form-section">What is it?</div>
        <Field label="Item name" wide><input autoFocus value={form.name} onChange={set("name")} placeholder="e.g. Nike zip hoodie" /></Field>
        <Field label="Brand"><input list="dl-brands" value={form.brand} onChange={set("brand")} placeholder="Type or pick" /></Field>
        <Field label="Category"><input list="dl-categories" value={form.category} onChange={set("category")} placeholder="Type or pick" /></Field>
        <Field label="Size"><input list="dl-sizes" value={form.size} onChange={set("size")} placeholder="e.g. M" /></Field>
        <Field label="Colour"><input list="dl-colors" value={form.color} onChange={set("color")} /></Field>
        <Field label="Condition"><select value={form.condition} onChange={set("condition")}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Subcategory (optional)"><input value={form.subcategory} onChange={set("subcategory")} /></Field>

        <div className="form-section">What it cost</div>
        <Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={set("purchaseDate")} /></Field>
        <Field label="Purchase cost (£)"><input type="number" step="0.01" min="0" value={form.purchaseCost} onChange={set("purchaseCost")} /></Field>
        <Field label="Cleaning cost (£)"><input type="number" step="0.01" min="0" value={form.cleaningCost} onChange={set("cleaningCost")} /></Field>
        <Field label="Repair cost (£)"><input type="number" step="0.01" min="0" value={form.repairCost} onChange={set("repairCost")} /></Field>
        <Field label="Other cost (£)"><input type="number" step="0.01" min="0" value={form.otherCost} onChange={set("otherCost")} /></Field>
        <Field label="Supplier"><input list="dl-suppliers" value={form.supplier} onChange={set("supplier")} placeholder="Where you bought it" /></Field>
        <Field label="Storage location"><input list="dl-locations" value={form.location} onChange={set("location")} placeholder="e.g. Rail A" /></Field>

        <div className="form-section">Listing</div>
        <Field label="Status">
          {isSold ? (
            <input value="Sold" disabled />
          ) : (
            <select value={form.status} onChange={set("status")}>{STATUSES.filter((s) => s !== "Sold").map((s) => <option key={s}>{s}</option>)}</select>
          )}
        </Field>
        <Field label="Date listed"><input type="date" value={form.listedDate} onChange={set("listedDate")} disabled={form.status === "Not Listed"} /></Field>
        <Field label="Listing price (£)"><input type="number" step="0.01" min="0" value={form.listingPrice} onChange={set("listingPrice")} /></Field>
        <Field label="Notes" wide><input value={form.notes} onChange={set("notes")} placeholder="Flaws, measurements, anything to remember" /></Field>
      </div>

      <div className="calc-preview">
        <div>Total cost: <strong>{money(cost)}</strong></div>
        <div>At your listing price: <strong className={profit >= 0 ? "text-green" : "text-red"}>{money(profit)} profit</strong></div>
        <div>ROI: <strong>{pct(roi)}</strong></div>
      </div>
      {!isSold && <p className="muted-text" style={{ marginTop: 10 }}>To mark an item as sold, save it and tap Sell. That records the sale and updates your dashboard.</p>}
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>Save item</button>
      </div>
    </Modal>
  );
}

function ItemDetailModal({ item, settings, onClose, onEdit, onSell, onDelete }) {
  const s = item.sale;
  const facts = [
    ["Brand", item.brand], ["Category", item.subcategory ? `${item.category}, ${item.subcategory}` : item.category],
    ["Size", item.size || "—"], ["Colour", item.color || "—"], ["Condition", item.condition || "—"],
    ["Supplier", item.supplier || "—"], ["Storage", item.location || "—"],
    ["Bought", fmtDate(item.purchaseDate) || "—"], ["Listed", item.listedDate ? fmtDate(item.listedDate) : "Not listed yet"],
  ];
  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div style={{ marginBottom: 12 }}><StatusBadge status={item.status} /></div>
      <div className="big-nums">
        <div className="big-num"><span className="num-label">{s ? "Sold for" : "Asking price"}</span><strong>{money(item.shownPrice)}</strong></div>
        <div className="big-num"><span className="num-label">{s ? "Profit" : "Potential profit"}</span><strong className={item.shownProfit >= 0 ? "text-green" : "text-red"}>{money(item.shownProfit)}</strong></div>
        <div className="big-num"><span className="num-label">{s ? "ROI" : "Potential ROI"}</span><strong>{pct(item.shownROI)}</strong></div>
      </div>
      <div className="detail-grid">
        {facts.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
        <div><span>Purchase cost</span><strong>{money(item.purchaseCost)}</strong></div>
        <div><span>Cleaning</span><strong>{money(item.cleaningCost)}</strong></div>
        <div><span>Repairs</span><strong>{money(item.repairCost)}</strong></div>
        <div><span>Other costs</span><strong>{money(item.otherCost)}</strong></div>
        <div><span>Total cost</span><strong>{money(item.totalCost)}</strong></div>
        {s && <div><span>Sold on</span><strong>{fmtDate(s.saleDate)}</strong></div>}
        {s && <div><span>Sale costs</span><strong>{money(s.extra)}</strong></div>}
        {s && <div><span>Days to sell</span><strong>{s.daysToSell}</strong></div>}
        {!s && item.isActive && <div><span>Days in stock</span><strong>{item.stockAge}</strong></div>}
        {!s && item.daysListed != null && <div><span>Days listed</span><strong>{item.daysListed}</strong></div>}
      </div>
      {item.notes && <p className="muted-text" style={{ marginTop: 12 }}><strong>Notes:</strong> {item.notes}</p>}
      <div className="modal-actions">
        <button className="btn-danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>
        <div className="spacer" />
        <button className="btn-ghost" onClick={onEdit}><Pencil size={15} /> Edit</button>
        {item.status !== "Sold" && <button className="btn-primary" onClick={onSell}><PackageCheck size={15} /> Sell</button>}
      </div>
    </Modal>
  );
}

function WelcomeModal({ mode, onExplore, onStartFresh }) {
  const steps = [
    ["Add your first item", "Open Inventory and tap Add item. Give it a name and a brand."],
    ["Enter your purchase price", "What you paid, plus any cleaning or repair costs."],
    ["Add your listing price", "RESELLR works out your potential profit and ROI straight away."],
    ["Record your first sale", "When it sells, tap Sell on the item and enter the sale price."],
    ["Watch your dashboard update", "Revenue, profit, brands and goals all recalculate by themselves."],
  ];
  return (
    <Modal title="Welcome to RESELLR" onClose={onExplore}>
      <p className="welcome-sub">The Command Centre for Vinted Resellers. Here's how to get going:</p>
      <ol className="steps">
        {steps.map(([t, d], i) => (
          <li key={t}><span className="step-n">{i + 1}</span><div><div className="step-t">{t}</div><div className="step-d">{d}</div></div></li>
        ))}
      </ol>
      <div className="welcome-note">
        The app is loaded with demo data so you can see how it looks. Your own data is saved in this browser on this device, so download a backup from Settings now and then.
      </div>
      <div className="modal-actions">
        {mode === "first" ? (
          <>
            <button className="btn-ghost" onClick={onExplore}>Explore with demo data</button>
            <button className="btn-primary" onClick={onStartFresh}>Start with my own data</button>
          </>
        ) : (
          <button className="btn-primary" onClick={onExplore}>Got it</button>
        )}
      </div>
    </Modal>
  );
}

function SellModal({ item, onClose, onConfirm }) {
  const [form, setForm] = useState({
    saleDate: todayISO(), salePrice: item.listingPrice || "", additionalCosts: "", packagingCost: "", postageCost: "", platformFees: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cost = totalItemCost(item);
  const extra = (Number(form.additionalCosts) || 0) + (Number(form.packagingCost) || 0) + (Number(form.postageCost) || 0) + (Number(form.platformFees) || 0);
  const profit = (Number(form.salePrice) || 0) - cost - extra;

  return (
    <Modal title={`Mark "${item.name}" as sold`} onClose={onClose}>
      <div className="form-grid">
        <Field label="Sale date"><input type="date" value={form.saleDate} onChange={set("saleDate")} /></Field>
        <Field label="Sale price (£)"><input type="number" step="0.01" value={form.salePrice} onChange={set("salePrice")} /></Field>
        <Field label="Additional costs (£)"><input type="number" step="0.01" value={form.additionalCosts} onChange={set("additionalCosts")} /></Field>
        <Field label="Packaging cost (£)"><input type="number" step="0.01" value={form.packagingCost} onChange={set("packagingCost")} /></Field>
        <Field label="Postage cost (£)"><input type="number" step="0.01" value={form.postageCost} onChange={set("postageCost")} /></Field>
        <Field label="Platform fees (£)"><input type="number" step="0.01" value={form.platformFees} onChange={set("platformFees")} /></Field>
      </div>
      <div className="calc-preview">
        <div>Item cost: <strong>{money(cost)}</strong></div>
        <div>Profit: <strong className={profit >= 0 ? "text-green" : "text-red"}>{money(profit)}</strong></div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!(Number(form.salePrice) > 0)} onClick={() => onConfirm({
          saleDate: form.saleDate,
          salePrice: Number(form.salePrice) || 0,
          additionalCosts: Number(form.additionalCosts) || 0,
          packagingCost: Number(form.packagingCost) || 0,
          postageCost: Number(form.postageCost) || 0,
          platformFees: Number(form.platformFees) || 0,
        })}>Confirm sale</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  SALES                                                                   */
/* ---------------------------------------------------------------------- */

function SalesPage({ salesCalc, settings, onDelete, onExport }) {
  const [q, setQ] = useState("");
  const sorted = useMemo(() => {
    return [...salesCalc]
      .filter((s) => !q || `${s.item?.name} ${s.item?.brand}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.saleDate || "").localeCompare(a.saleDate || ""));
  }, [salesCalc, q]);

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search-box"><Search size={15} /><input placeholder="Search sales…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="spacer" />
        <button className="btn-ghost" onClick={onExport}><Download size={15} /> Export CSV</button>
      </div>
      <Panel>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Brand</th><th>Sale date</th><th>Sale price</th><th>Cost</th><th>Extra costs</th><th>Profit</th><th>Margin</th><th>ROI</th><th>Days to sell</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id}>
                  <td>{s.item?.name || "(deleted item)"}</td>
                  <td>{s.item?.brand || "—"}</td>
                  <td>{s.saleDate}</td>
                  <td>{money(s.salePrice)}</td>
                  <td>{money(s.totalCost)}</td>
                  <td>{money(s.extra)}</td>
                  <td className={s.profit >= 0 ? "text-green" : "text-red"}>{money(s.profit)}</td>
                  <td>{pct(s.margin)}</td>
                  <td><RoiBadge value={s.roi} settings={settings} /></td>
                  <td>{s.daysToSell}d</td>
                  <td><button className="icon-btn" title="Undo sale" onClick={() => { if (window.confirm("Remove this sale and return item to Listed?")) onDelete(s.id, s.itemId); }}><Trash2 size={15} /></button></td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={11} className="empty-cell">No sales recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  EXPENSES                                                                */
/* ---------------------------------------------------------------------- */

function ExpensesPage({ expenses, onAdd, onEdit, onDelete, onExport }) {
  const byCat = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const total = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const thisMonth = expenses.filter((e) => monthKey(e.date) === thisMk()).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  function thisMk() { return todayISO().slice(0, 7); }

  const sorted = [...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const thisYear = expenses.filter((e) => String(e.date || "").slice(0, 4) === todayISO().slice(0, 4)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const byMonth = (() => {
    const map = {};
    expenses.forEach((e) => { const k = monthKey(e.date); if (k) map[k] = (map[k] || 0) + (Number(e.amount) || 0); });
    return Object.keys(map).sort().slice(-8).map((k) => ({ month: monthLabel(k), Expenses: Number(map[k].toFixed(2)) }));
  })();

  return (
    <div className="stack">
      <div className="kpi-grid kpi-grid-4">
        <KpiCard label="Total expenses" value={money(total)} />
        <KpiCard label="This month" value={money(thisMonth)} />
        <KpiCard label="This year" value={money(thisYear)} />
        <KpiCard label="Entries logged" value={expenses.length} />
      </div>
      <div className="grid-2">
        <Panel title="Expense breakdown">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {byCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Add / manage expenses" action={<button className="btn-primary" onClick={onAdd}><Plus size={15} /> Add expense</button>}>
          <div className="table-scroll" style={{ maxHeight: 240 }}>
            <table className="table compact">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {sorted.slice(0, 8).map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td><td>{e.category}</td><td>{e.description}</td><td>{money(e.amount)}</td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => onEdit(e)}><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => { if (window.confirm("Delete expense?")) onDelete(e.id); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel title="Expenses over time">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMonth}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="var(--ink-soft)" fontSize={12} />
            <YAxis stroke="var(--ink-soft)" fontSize={12} />
            <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 }} />
            <Bar dataKey="Expenses" fill="#C77B2C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="All expenses" action={<button className="btn-ghost" onClick={onExport}><Download size={15} /> Export CSV</button>}>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Supplier</th><th></th></tr></thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.category}</td><td>{e.description}</td><td>{money(e.amount)}</td><td>{e.supplier}</td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => onEdit(e)}><Pencil size={14} /></button>
                    <button className="icon-btn" onClick={() => { if (window.confirm("Delete expense?")) onDelete(e.id); }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={6} className="empty-cell">No expenses logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ExpenseModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { date: todayISO(), category: EXPENSE_CATS[0], description: "", amount: "", supplier: "", notes: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={initial ? "Edit expense" : "Add expense"} onClose={onClose}>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={form.date} onChange={set("date")} /></Field>
        <Field label="Category"><select value={form.category} onChange={set("category")}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Description"><input value={form.description} onChange={set("description")} /></Field>
        <Field label="Amount (£)"><input type="number" step="0.01" value={form.amount} onChange={set("amount")} /></Field>
        <Field label="Supplier"><input value={form.supplier} onChange={set("supplier")} /></Field>
        <Field label="Notes"><input value={form.notes} onChange={set("notes")} /></Field>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave({ ...form, id: initial?.id })}>Save expense</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  BUY OR PASS                                                             */
/* ---------------------------------------------------------------------- */

function BuyPassPage({ settings }) {
  const [form, setForm] = useState({ brand: "", itemType: "", purchasePrice: "", expectedPrice: "", additionalCosts: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const purchase = Number(form.purchasePrice) || 0;
  const expected = Number(form.expectedPrice) || 0;
  const extra = Number(form.additionalCosts) || 0;
  const totalCost = purchase + extra;
  const profit = expected - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const margin = expected > 0 ? (profit / expected) * 100 : 0;
  const breakEven = totalCost;
  const suggestedMax = Math.max(0, expected / (1 + settings.roiBuyThreshold / 100) - extra);

  let verdict = "PASS", vClass = "verdict-red", reason = "ROI is below your pass threshold — this purchase is unlikely to be worth your time.";
  if (roi >= settings.roiBuyThreshold) { verdict = "BUY"; vClass = "verdict-green"; reason = `Strong ${pct(roi)} ROI relative to the ${money(totalCost)} you'd have in it.`; }
  else if (roi >= settings.roiConsiderThreshold) { verdict = "CONSIDER"; vClass = "verdict-amber"; reason = `${pct(roi)} ROI is workable but not exceptional — only buy if condition and demand are strong.`; }

  return (
    <div className="stack">
      <div className="grid-2">
        <Panel title="Item details">
          <div className="form-grid one-col">
            <Field label="Brand"><input value={form.brand} onChange={set("brand")} placeholder="e.g. Patagonia" /></Field>
            <Field label="Item type"><input value={form.itemType} onChange={set("itemType")} placeholder="e.g. Retro-X fleece" /></Field>
            <Field label="Purchase price (£)"><input type="number" step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} /></Field>
            <Field label="Expected selling price (£)"><input type="number" step="0.01" value={form.expectedPrice} onChange={set("expectedPrice")} /></Field>
            <Field label="Estimated additional costs (£)"><input type="number" step="0.01" value={form.additionalCosts} onChange={set("additionalCosts")} placeholder="cleaning, postage, packaging…" /></Field>
          </div>
        </Panel>

        <Panel title="Verdict">
          <div className={`verdict-block ${vClass}`}>
            <div className="verdict-word">{verdict}</div>
            <div className="verdict-reason">{reason}</div>
          </div>
          <div className="calc-rows">
            <div><span>Expected profit</span><strong className={profit >= 0 ? "text-green" : "text-red"}>{money(profit)}</strong></div>
            <div><span>ROI</span><strong>{pct(roi)}</strong></div>
            <div><span>Profit margin</span><strong>{pct(margin)}</strong></div>
            <div><span>Break-even sale price</span><strong>{money(breakEven)}</strong></div>
            <div><span>Suggested max purchase price</span><strong>{money(suggestedMax)}</strong></div>
          </div>
        </Panel>
      </div>
      <Panel title="How this works">
        <p className="muted-text">
          Buy triggers at {settings.roiBuyThreshold}%+ ROI, Consider at {settings.roiConsiderThreshold}–{settings.roiBuyThreshold}%, and Pass below {settings.roiConsiderThreshold}%.
          Adjust these thresholds any time in Settings to match how you like to source.
        </p>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  PRICING CALCULATOR                                                     */
/* ---------------------------------------------------------------------- */

function PricingCalculatorPage() {
  const [form, setForm] = useState({ purchasePrice: "", costs: "", desiredProfit: "", desiredRoi: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const purchase = Number(form.purchasePrice) || 0;
  const costs = Number(form.costs) || 0;
  const base = purchase + costs;
  const desiredProfit = Number(form.desiredProfit) || 0;
  const desiredRoi = Number(form.desiredRoi) || 0;

  const minSellingPrice = base + desiredProfit;
  const breakEven = base;
  const priceForRoi = (roi) => base * (1 + roi / 100);
  const priceForDesiredRoi = base * (1 + desiredRoi / 100);

  return (
    <div className="stack">
      <div className="grid-2">
        <Panel title="Your numbers">
          <div className="form-grid one-col">
            <Field label="Purchase price (£)"><input type="number" step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} /></Field>
            <Field label="Other costs (£)"><input type="number" step="0.01" value={form.costs} onChange={set("costs")} placeholder="cleaning, postage, packaging…" /></Field>
            <Field label="Desired profit (£)"><input type="number" step="0.01" value={form.desiredProfit} onChange={set("desiredProfit")} /></Field>
            <Field label="Desired ROI (%)"><input type="number" step="1" value={form.desiredRoi} onChange={set("desiredRoi")} /></Field>
          </div>
        </Panel>
        <Panel title="Recommended pricing">
          <div className="calc-rows">
            <div><span>Break-even price</span><strong>{money(breakEven)}</strong></div>
            <div><span>Minimum selling price (for desired profit)</span><strong>{money(minSellingPrice)}</strong></div>
            <div><span>Price for desired ROI</span><strong>{money(priceForDesiredRoi)}</strong></div>
            <div><span>Price for 25% ROI</span><strong>{money(priceForRoi(25))}</strong></div>
            <div><span>Price for 50% ROI</span><strong>{money(priceForRoi(50))}</strong></div>
            <div><span>Price for 100% ROI</span><strong>{money(priceForRoi(100))}</strong></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  BRANDS / SUPPLIERS RANK PAGE                                           */
/* ---------------------------------------------------------------------- */

function RankPage({ title, stats, settings, isSupplier }) {
  const chartData = stats.slice(0, 8).map((s) => ({ name: s.key, Profit: Number(s.profit.toFixed(2)) }));
  return (
    <div className="stack">
      <Panel title={`${title} — ranked by profit`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke="var(--ink-soft)" fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="var(--ink-soft)" fontSize={12} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 }} />
            <Bar dataKey="Profit" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title={isSupplier ? "Where to source more stock" : "Full breakdown"}>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>#</th><th>{isSupplier ? "Supplier" : "Brand"}</th><th>Bought</th><th>Spend</th><th>Sold</th><th>Revenue</th><th>Profit</th><th>Avg profit</th><th>Avg ROI</th><th>Sell-through</th><th>Avg days to sell</th></tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.key}>
                  <td>{i + 1}</td>
                  <td>{s.key}</td>
                  <td>{s.bought}</td>
                  <td>{money(s.spend)}</td>
                  <td>{s.sold}</td>
                  <td>{money(s.revenue)}</td>
                  <td className={s.profit >= 0 ? "text-green" : "text-red"}>{money(s.profit)}</td>
                  <td>{money(s.avgProfit)}</td>
                  <td><RoiBadge value={s.avgROI} settings={settings} /></td>
                  <td>{pct(s.sellThrough)}</td>
                  <td>{s.avgDaysToSell.toFixed(0)}d</td>
                </tr>
              ))}
              {stats.length === 0 && <tr><td colSpan={11} className="empty-cell">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  MONTHLY PERFORMANCE                                                    */
/* ---------------------------------------------------------------------- */

function MonthlyPage({ monthlyStats, thisMonth, prevMonth, changePct }) {
  const chartData = monthlyStats.slice(-8).map((m) => ({ month: monthLabel(m.key), Revenue: Number(m.revenue.toFixed(2)), Profit: Number(m.profit.toFixed(2)) }));
  const revChange = changePct(thisMonth.revenue, prevMonth.revenue);
  const profitChange = changePct(thisMonth.profit, prevMonth.profit);
  const salesChange = changePct(thisMonth.sales, prevMonth.sales);

  return (
    <div className="stack">
      <div className="kpi-grid kpi-grid-3">
        <KpiCard label="Revenue" value={money(thisMonth.revenue)} sub={`${revChange >= 0 ? "+" : ""}${revChange.toFixed(0)}% vs last month`} trend={revChange >= 0 ? "up" : "down"} />
        <KpiCard label="Profit" value={money(thisMonth.profit)} sub={`${profitChange >= 0 ? "+" : ""}${profitChange.toFixed(0)}% vs last month`} trend={profitChange >= 0 ? "up" : "down"} />
        <KpiCard label="Sales" value={thisMonth.sales || 0} sub={`${salesChange >= 0 ? "+" : ""}${salesChange.toFixed(0)}% vs last month`} trend={salesChange >= 0 ? "up" : "down"} />
      </div>
      <Panel title="Revenue & profit by month">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="var(--ink-soft)" fontSize={12} />
            <YAxis stroke="var(--ink-soft)" fontSize={12} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 }} />
            <Legend />
            <Bar dataKey="Revenue" fill="#3D7A8A" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Profit" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Month-by-month detail">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Month</th><th>Revenue</th><th>Profit</th><th>Sales</th><th>Avg sale price</th><th>Avg ROI</th><th>Stock spend</th><th>Listings added</th><th>Expenses</th></tr></thead>
            <tbody>
              {[...monthlyStats].reverse().map((m) => (
                <tr key={m.key}>
                  <td>{monthLabel(m.key)}</td>
                  <td>{money(m.revenue)}</td>
                  <td className={m.profit >= 0 ? "text-green" : "text-red"}>{money(m.profit)}</td>
                  <td>{m.sales || 0}</td>
                  <td>{money(m.avgSalePrice)}</td>
                  <td>{pct(m.avgROI)}</td>
                  <td>{money(m.spend || 0)}</td>
                  <td>{m.listings || 0}</td>
                  <td>{money(m.expenses || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  GOALS                                                                   */
/* ---------------------------------------------------------------------- */

function GoalsPage({ goals, setGoals, thisMonth, totals }) {
  const [form, setForm] = useState(goals);
  useEffect(() => setForm(goals), [goals]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="stack">
      <div className="grid-2">
        <Panel title="This month's progress">
          <div className="goal-row">
            <div className="goal-head"><span>Revenue</span><span>{money(thisMonth.revenue)} / {money(goals.revenue)}</span></div>
            <ProgressBar value={thisMonth.revenue} max={goals.revenue} colorClass="fill-blue" />
          </div>
          <div className="goal-row">
            <div className="goal-head"><span>Profit</span><span>{money(thisMonth.profit)} / {money(goals.profit)}</span></div>
            <ProgressBar value={thisMonth.profit} max={goals.profit} colorClass="fill-green" />
          </div>
          <div className="goal-row">
            <div className="goal-head"><span>Sales</span><span>{thisMonth.sales || 0} / {goals.sales}</span></div>
            <ProgressBar value={thisMonth.sales || 0} max={goals.sales} colorClass="fill-amber" />
          </div>
          <div className="goal-row">
            <div className="goal-head"><span>New listings</span><span>{thisMonth.listings || 0} / {goals.listings}</span></div>
            <ProgressBar value={thisMonth.listings || 0} max={goals.listings} colorClass="fill-rust" />
          </div>
        </Panel>
        <Panel title="Set monthly targets">
          <div className="form-grid one-col">
            <Field label="Monthly revenue goal (£)"><input type="number" value={form.revenue} onChange={set("revenue")} /></Field>
            <Field label="Monthly profit goal (£)"><input type="number" value={form.profit} onChange={set("profit")} /></Field>
            <Field label="Monthly sales goal (items)"><input type="number" value={form.sales} onChange={set("sales")} /></Field>
            <Field label="Monthly new listings goal"><input type="number" value={form.listings} onChange={set("listings")} /></Field>
          </div>
          <div className="modal-actions" style={{ padding: 0, marginTop: 12 }}>
            <button className="btn-primary" onClick={() => setGoals({
              revenue: Number(form.revenue) || 0, profit: Number(form.profit) || 0,
              sales: Number(form.sales) || 0, listings: Number(form.listings) || 0,
            })}>Save targets</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SETTINGS                                                                */
/* ---------------------------------------------------------------------- */

function SettingsPage({ settings, setSettings, lastBackup, onClear, onReload, onExportAll, onBackup, onRestore, onWelcome }) {
  const restoreInput = useRef(null);
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="stack">
      <Panel title="Business">
        <div className="form-grid one-col">
          <Field label="Business name"><input value={form.businessName} onChange={set("businessName")} /></Field>
          <Field label="Currency"><input value="GBP (£)" disabled /></Field>
        </div>
      </Panel>
      <Panel title="Buy or Pass thresholds">
        <div className="form-grid one-col">
          <Field label="ROI% for a BUY verdict"><input type="number" value={form.roiBuyThreshold} onChange={set("roiBuyThreshold")} /></Field>
          <Field label="ROI% for a CONSIDER verdict"><input type="number" value={form.roiConsiderThreshold} onChange={set("roiConsiderThreshold")} /></Field>
        </div>
      </Panel>
      <Panel title="Stock age warnings">
        <div className="form-grid one-col">
          <Field label="Warn after (days)"><input type="number" value={form.ageWarn1} onChange={set("ageWarn1")} /></Field>
          <Field label="Flag after (days)"><input type="number" value={form.ageWarn2} onChange={set("ageWarn2")} /></Field>
          <Field label="Critical after (days)"><input type="number" value={form.ageWarn3} onChange={set("ageWarn3")} /></Field>
        </div>
      </Panel>
      <div className="modal-actions" style={{ padding: 0 }}>
        <button className="btn-primary" onClick={() => setSettings({
          ...form,
          roiBuyThreshold: Number(form.roiBuyThreshold) || 0,
          roiConsiderThreshold: Number(form.roiConsiderThreshold) || 0,
          ageWarn1: Number(form.ageWarn1) || 0,
          ageWarn2: Number(form.ageWarn2) || 0,
          ageWarn3: Number(form.ageWarn3) || 0,
        })}>Save settings</button>
      </div>

      <Panel title="Backup and restore">
        <p className="muted-text">
          Your data lives in this browser on this device. Download a backup regularly, and always before clearing
          your browser data. To move to a new device or browser, download a backup here, then restore it there.
        </p>
        <p className="muted-text" style={{ marginTop: 10 }}><strong>Last backup:</strong> {lastBackup ? fmtDate(lastBackup) : "never"}</p>
        <div className="settings-actions" style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={onBackup}><Download size={15} /> Download backup</button>
          <button className="btn-ghost" onClick={() => restoreInput.current && restoreInput.current.click()}>Restore from backup</button>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => { onRestore(e.target.files && e.target.files[0]); e.target.value = ""; }}
          />
        </div>
      </Panel>

      <Panel title="Data">
        <p className="muted-text">Your data is saved automatically in this browser. Use the backup above to keep a safe copy.</p>
        <div className="settings-actions">
          <button className="btn-ghost" onClick={onExportAll}><Download size={15} /> Export all data (CSV)</button>
          <button className="btn-ghost" onClick={onReload}>Reload demo data</button>
          <button className="btn-ghost" onClick={onWelcome}>Show welcome guide</button>
          <button className="btn-danger" onClick={onClear}><Trash2 size={15} /> Clear all data</button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  STYLES                                                                  */
/* ---------------------------------------------------------------------- */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

:root{
  --paper:#F3F2EC;
  --card:#FFFFFF;
  --ink:#16211D;
  --ink-soft:#5B6459;
  --line:#DCD8C9;
  --accent:#2F6F52;
  --accent-soft:#E4EEE7;
  --rust:#C77B2C;
  --rust-soft:#F5E6D3;
  --blue:#3D7A8A;
  --blue-soft:#E1EDF0;
  --danger:#B3462C;
  --danger-soft:#F5E1DA;
  --amber:#B98A1E;
  --amber-soft:#F6EBD3;
  --radius:6px;
}
*{box-sizing:border-box;}
.app{
  display:flex; min-height:100vh; width:100%; background:var(--paper); color:var(--ink);
  font-family:'Inter',sans-serif; font-size:14px; line-height:1.45;
}
button, input, select { font-family:inherit; font-size:13px; color:var(--ink); }

/* Sidebar */
.sidebar{
  width:230px; background:var(--ink); color:#EDEAE0; flex-shrink:0;
  display:flex; flex-direction:column; padding:20px 14px;
}
.brand{ display:flex; align-items:center; gap:10px; padding:0 6px 20px; border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:14px;}
.brand-mark{
  width:34px; height:34px; border-radius:6px; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif;
  font-weight:700; font-size:16px; color:#fff; flex-shrink:0;
}
.brand-name{ font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; letter-spacing:0.03em; }
.brand-sub{ font-size:11px; color:#A9B0A5; margin-top:1px; }
.nav-item{
  display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:9px 10px;
  background:none; border:none; border-radius:5px; color:#C9CFC3; cursor:pointer; margin-bottom:2px;
}
.nav-item:hover{ background:rgba(255,255,255,0.06); color:#fff; }
.nav-active{ background:var(--accent) !important; color:#fff !important; }

/* Main */
.main{ flex:1; min-width:0; display:flex; flex-direction:column; }
.topbar{
  display:flex; align-items:center; gap:12px; padding:16px 26px; background:var(--paper);
  border-bottom:1px solid var(--line); position:sticky; top:0; z-index:5;
}
.topbar h1{ font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:600; flex:1; }
.health-pill{ font-size:12px; font-weight:600; padding:5px 11px; border-radius:20px; }
.health-green{ background:var(--accent-soft); color:var(--accent); }
.health-amber{ background:var(--amber-soft); color:var(--amber); }
.health-red{ background:var(--danger-soft); color:var(--danger); }
.content{ padding:22px 26px 60px; }
.mobile-only{ display:none; }

.stack{ display:flex; flex-direction:column; gap:18px; }
.grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }

/* KPI */
.kpi-grid{ display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
.kpi-grid-3{ grid-template-columns:repeat(3,1fr); }
.kpi-card{ background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:14px 16px; }
.kpi-label{ font-size:11.5px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px; }
.kpi-value{ font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:600; }
.kpi-trend{ display:flex; align-items:center; gap:3px; font-size:11.5px; margin-top:5px; color:var(--ink-soft); }
.trend-up{ color:var(--accent); }
.trend-down{ color:var(--danger); }

/* Panel */
.panel{ background:var(--card); border:1px solid var(--line); border-radius:var(--radius); }
.panel-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--line); }
.panel-head h3{ font-family:'Space Grotesk',sans-serif; font-size:14.5px; font-weight:600; }
.panel-body{ padding:16px 18px; }

/* Table */
.table-scroll{ overflow-x:auto; }
.table{ width:100%; border-collapse:collapse; font-size:13px; }
.table th{ text-align:left; padding:9px 10px; border-bottom:1px solid var(--line); color:var(--ink-soft); font-weight:600; font-size:11.5px; text-transform:uppercase; letter-spacing:0.03em; white-space:nowrap; }
.table td{ padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:middle; }
.table tbody tr:hover{ background:var(--paper); }
.table.compact td, .table.compact th{ padding:7px 8px; }
.sortable{ cursor:pointer; user-select:none; }
.cell-sub{ font-size:11px; color:var(--ink-soft); }
.row-warn{ background:var(--amber-soft); }
.row-danger{ background:var(--danger-soft); }
.row-actions{ display:flex; gap:4px; white-space:nowrap; }
.empty-cell, .empty-state{ text-align:center; color:var(--ink-soft); padding:22px; display:flex; align-items:center; justify-content:center; gap:8px; }

/* Badges */
.badge{ display:inline-block; padding:3px 9px; border-radius:20px; font-size:11.5px; font-weight:600; white-space:nowrap; }
.badge-grey{ background:#E7E5DC; color:var(--ink-soft); }
.badge-blue{ background:var(--blue-soft); color:var(--blue); }
.badge-amber{ background:var(--amber-soft); color:var(--amber); }
.badge-green{ background:var(--accent-soft); color:var(--accent); }
.badge-red{ background:var(--danger-soft); color:var(--danger); }

/* Buttons */
.btn-primary, .btn-ghost, .btn-danger{
  display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:5px; font-weight:600;
  font-size:13px; cursor:pointer; border:1px solid transparent; white-space:nowrap;
}
.btn-primary{ background:var(--ink); color:#fff; }
.btn-primary:hover{ background:var(--accent); }
.btn-ghost{ background:transparent; border-color:var(--line); color:var(--ink); }
.btn-ghost:hover{ background:var(--card); }
.btn-danger{ background:transparent; border-color:var(--danger); color:var(--danger); }
.btn-danger:hover{ background:var(--danger-soft); }
.icon-btn{ background:transparent; border:1px solid transparent; padding:5px; border-radius:4px; cursor:pointer; display:flex; color:var(--ink-soft); }
.icon-btn:hover{ background:var(--paper); color:var(--ink); }
.link-btn{ background:none; border:none; color:var(--accent); font-weight:600; font-size:12.5px; cursor:pointer; padding:10px 0 0; }

/* Toolbar */
.toolbar{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.search-box{ display:flex; align-items:center; gap:6px; background:var(--card); border:1px solid var(--line); border-radius:5px; padding:7px 10px; flex:1; min-width:180px; color:var(--ink-soft); }
.search-box input{ border:none; outline:none; background:none; flex:1; color:var(--ink); }
select{ background:var(--card); border:1px solid var(--line); border-radius:5px; padding:7px 10px; }
.spacer{ flex:1; }

/* Forms */
.form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
.form-grid.one-col{ grid-template-columns:1fr; }
.field{ display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:var(--ink-soft); font-weight:600; }
.field input, .field select{ border:1px solid var(--line); border-radius:5px; padding:8px 10px; color:var(--ink); font-weight:400; }
.field input:focus, .field select:focus{ outline:2px solid var(--accent); outline-offset:1px; border-color:var(--accent); }
.field input:disabled{ background:var(--paper); color:var(--ink-soft); }

/* Modal */
.modal-overlay{ position:fixed; inset:0; background:rgba(22,33,29,0.45); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; }
.modal{ background:var(--card); border-radius:8px; width:100%; max-width:460px; max-height:88vh; overflow-y:auto; }
.modal-wide{ max-width:720px; }
.modal-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--line); }
.modal-head h3{ font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:600; }
.modal-body{ padding:18px 20px 20px; }
.modal-actions{ display:flex; justify-content:flex-end; gap:10px; padding-top:16px; }
.calc-preview{ display:flex; gap:20px; background:var(--paper); border-radius:6px; padding:10px 14px; margin-top:14px; font-size:13px; }

/* Health */
.health-block{ display:flex; align-items:baseline; gap:12px; margin-bottom:10px; }
.health-score{ font-family:'Space Grotesk',sans-serif; font-size:40px; font-weight:700; }
.health-label{ font-size:14px; font-weight:600; color:var(--ink-soft); }
.health-tips{ list-style:none; display:flex; flex-direction:column; gap:8px; padding:0; margin:0; font-size:12.5px; color:var(--ink-soft); }
.health-tips li{ padding-left:14px; position:relative; }
.health-tips li:before{ content:"—"; position:absolute; left:0; color:var(--rust); }
.muted-count{ font-size:12px; color:var(--ink-soft); background:var(--paper); padding:2px 9px; border-radius:20px; }
.muted-text{ color:var(--ink-soft); font-size:13px; }

/* Progress / goals */
.goal-row{ margin-bottom:16px; }
.goal-row:last-child{ margin-bottom:0; }
.goal-head{ display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px; color:var(--ink-soft); font-weight:600; }
.progress-track{ height:9px; background:var(--paper); border-radius:20px; overflow:hidden; border:1px solid var(--line); }
.progress-fill{ height:100%; border-radius:20px; }
.fill-blue{ background:var(--blue); } .fill-green{ background:var(--accent); } .fill-amber{ background:var(--amber); } .fill-rust{ background:var(--rust); }

/* Buy/pass verdict */
.verdict-block{ text-align:center; padding:22px 10px; border-radius:8px; margin-bottom:16px; }
.verdict-word{ font-family:'Space Grotesk',sans-serif; font-size:32px; font-weight:700; letter-spacing:0.03em; }
.verdict-reason{ font-size:13px; margin-top:6px; }
.verdict-green{ background:var(--accent-soft); color:var(--accent); }
.verdict-amber{ background:var(--amber-soft); color:var(--amber); }
.verdict-red{ background:var(--danger-soft); color:var(--danger); }
.calc-rows{ display:flex; flex-direction:column; gap:10px; }
.calc-rows > div{ display:flex; justify-content:space-between; border-bottom:1px dashed var(--line); padding-bottom:8px; font-size:13px; }
.calc-rows > div:last-child{ border-bottom:none; }

.settings-actions{ display:flex; gap:10px; flex-wrap:wrap; }

.text-green{ color:var(--accent); font-weight:600; }
.text-red{ color:var(--danger); font-weight:600; }

.toast{
  position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff;
  padding:10px 18px; border-radius:6px; font-size:13px; z-index:100; box-shadow:0 6px 20px rgba(0,0,0,0.2);
}
.loading-screen{ min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--paper); color:var(--ink-soft); font-family:'Inter',sans-serif; }

/* ---- v2 additions ---- */
.app{ font-variant-numeric:tabular-nums; }
.sidebar{ position:sticky; top:0; height:100vh; overflow-y:auto; align-self:flex-start; }
.sidebar-backdrop{ display:none; }
.sidebar-foot{ margin-top:auto; padding:14px 8px 4px; border-top:1px solid rgba(255,255,255,0.12); font-size:12px; color:#A9B0A5; }
.foot-title{ display:flex; align-items:center; gap:6px; color:#EDEAE0; font-weight:600; }
.foot-sub{ margin:4px 0 9px; }
.foot-btn{ width:100%; background:rgba(255,255,255,0.08); color:#fff; border:none; border-radius:5px; padding:8px 10px; cursor:pointer; font-weight:600; }
.foot-btn:hover{ background:rgba(255,255,255,0.18); }

.banner{ display:flex; align-items:center; gap:14px; background:var(--amber-soft); border:1px solid #E6D3A3; color:#5C4713; border-radius:var(--radius); padding:12px 16px; }
.banner > div{ flex:1; }
.banner-red{ background:var(--danger-soft); border-color:#E7BBAE; color:#6B2514; }
.banner-top{ margin:16px 26px 0; }

.btn-primary:disabled{ opacity:.45; cursor:not-allowed; }
.btn-primary:disabled:hover{ background:var(--ink); }
.btn-mini{ display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:5px; font-size:12px; font-weight:600; border:1px solid var(--accent); color:var(--accent); background:var(--accent-soft); cursor:pointer; white-space:nowrap; }
.btn-mini:hover{ background:var(--accent); color:#fff; }

.filters{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.filter-count{ margin-left:auto; font-size:12px; color:var(--ink-soft); }
.cell-main{ font-weight:600; }
.reason{ font-size:12.5px; color:var(--ink); }
.table tbody tr.clickable{ cursor:pointer; }
.table th.col-actions, .table td.col-actions{ position:sticky; right:0; background:var(--card); box-shadow:-8px 0 8px -8px rgba(22,33,29,0.18); }
.table tbody tr:hover td.col-actions{ background:var(--paper); }
.table tr.row-warn td.col-actions{ background:var(--amber-soft); }
.table tr.row-danger td.col-actions{ background:var(--danger-soft); }
.table .row-actions{ align-items:center; justify-content:flex-end; }

.inv-cards{ display:none; flex-direction:column; gap:10px; }
.inv-card{ background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; cursor:pointer; }
.inv-card.row-warn{ background:var(--amber-soft); }
.inv-card.row-danger{ background:var(--danger-soft); }
.inv-card-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.inv-card-nums{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px 8px; margin:12px 0; font-size:13px; }
.num-label{ display:block; color:var(--ink-soft); font-size:11px; margin-bottom:2px; }
.inv-card-actions{ display:flex; align-items:center; gap:6px; }

.form-section{ grid-column:1/-1; font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:13px; color:var(--ink); padding:8px 0 4px; border-bottom:1px solid var(--line); }
.form-section:first-child{ padding-top:0; }
.field-wide{ grid-column:1/-1; }
.form-error{ margin-top:12px; padding:9px 12px; border-radius:5px; background:var(--danger-soft); color:var(--danger); font-weight:600; font-size:13px; }
.calc-preview{ flex-wrap:wrap; }

.big-nums{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
.big-num{ background:var(--paper); border-radius:6px; padding:10px 12px; }
.big-num strong{ display:block; font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:600; }
.detail-grid{ display:grid; grid-template-columns:1fr 1fr; gap:0 22px; }
.detail-grid > div{ display:flex; justify-content:space-between; gap:10px; border-bottom:1px dashed var(--line); padding:7px 0; font-size:13px; }
.detail-grid span{ color:var(--ink-soft); }

.steps{ list-style:none; padding:0; margin:16px 0; display:flex; flex-direction:column; gap:13px; }
.steps li{ display:flex; gap:12px; align-items:flex-start; }
.step-n{ flex:0 0 26px; height:26px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; }
.step-t{ font-weight:600; }
.step-d{ color:var(--ink-soft); font-size:12.5px; }
.welcome-sub{ color:var(--ink-soft); }
.welcome-note{ background:var(--paper); border-radius:6px; padding:10px 12px; font-size:12.5px; color:var(--ink-soft); }
.kpi-grid-4{ grid-template-columns:repeat(4,1fr); }
.modal-actions .spacer{ flex:1; }
:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }

@media (max-width: 980px){
  .kpi-grid{ grid-template-columns:repeat(2,1fr); }
  .grid-2{ grid-template-columns:1fr; }
  .form-grid{ grid-template-columns:1fr; }
}
@media (max-width: 760px){
  .sidebar{ position:fixed; z-index:40; height:100vh; transform:translateX(-100%); transition:transform .2s ease; }
  .sidebar-open{ transform:translateX(0); }
  .mobile-only{ display:flex; }
  .content{ padding:16px; }
  .topbar{ padding:14px 16px; }
  .kpi-grid, .kpi-grid-3{ grid-template-columns:1fr 1fr; }
}
@media (max-width: 980px){ .kpi-grid-4{ grid-template-columns:repeat(2,1fr); } }
@media (max-width: 760px){
  .sidebar-backdrop{ display:block; position:fixed; inset:0; background:rgba(22,33,29,0.45); z-index:35; }
  .only-desktop{ display:none; }
  .inv-cards{ display:flex; }
  .banner{ flex-direction:column; align-items:flex-start; }
  .banner-top{ margin:12px 16px 0; }
  .detail-grid{ grid-template-columns:1fr; }
  .big-num strong{ font-size:16px; }
  .search-box{ min-width:100%; }
  .filter-count{ margin-left:0; width:100%; }
}
`;
