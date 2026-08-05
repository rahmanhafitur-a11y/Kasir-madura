import express from "express";
import session from "express-session";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

// ---- kredensial login (bisa diganti lewat Environment Variables di Railway) ----
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "warung123";
const SESSION_SECRET = process.env.SESSION_SECRET || "ganti-secret-ini-lewat-railway";

const app = express();
app.set("trust proxy", 1); // perlu karena Railway jalan di belakang proxy
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, sameSite: "lax" }, // sesi login 7 hari
  })
);
app.use(express.static(path.join(__dirname, "public")));

// ---- middleware: cek apakah sudah login sebelum akses data ----
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.status(401).json({ error: "Belum login" });
}

// ---- cek status login (dipakai frontend saat halaman dibuka) ----
app.get("/api/session", (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

// ---- login ----
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Username atau password salah" });
});

// ---- logout ----
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Sampoerna Mild", category: "Rokok", price: 30000, stock: 20 },
  { id: "p2", name: "Gudang Garam Filter", category: "Rokok", price: 25000, stock: 20 },
  { id: "p3", name: "Djarum Super", category: "Rokok", price: 27000, stock: 20 },
  { id: "p4", name: "Air Mineral 600ml", category: "Minuman", price: 4000, stock: 30 },
  { id: "p5", name: "Teh Botol", category: "Minuman", price: 5000, stock: 30 },
  { id: "p6", name: "Kopi Sachet", category: "Minuman", price: 2000, stock: 30 },
  { id: "p7", name: "Indomie Goreng", category: "Snack", price: 3500, stock: 30 },
  { id: "p8", name: "Chitato", category: "Snack", price: 11000, stock: 20 },
  { id: "p9", name: "Beras 1kg", category: "Sembako", price: 14000, stock: 15 },
  { id: "p10", name: "Minyak Goreng 1L", category: "Sembako", price: 18000, stock: 15 },
  { id: "p11", name: "Telur 1kg", category: "Sembako", price: 28000, stock: 15 },
  { id: "p12", name: "Gula 1kg", category: "Sembako", price: 16000, stock: 15 },
  { id: "p13", name: "Pulsa 10rb", category: "Pulsa/Token", price: 11000, stock: 50 },
  { id: "p14", name: "Token Listrik 20rb", category: "Pulsa/Token", price: 21000, stock: 50 },
  { id: "p15", name: "Gas LPG 3kg", category: "Lainnya", price: 22000, stock: 10 },
];

// ---- baca / tulis data.json (ini "gudang penyimpanan" datanya) ----
async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    const initial = { products: DEFAULT_PRODUCTS, transactions: [] };
    await writeData(initial);
    return initial;
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---- ambil semua data (produk + riwayat transaksi) ----
app.get("/api/data", requireLogin, async (req, res) => {
  const data = await readData();
  res.json(data);
});

// ---- produk: tambah ----
app.post("/api/products", requireLogin, async (req, res) => {
  const data = await readData();
  const newProduct = { id: `p_${Date.now()}`, stock: 0, ...req.body };
  data.products.push(newProduct);
  await writeData(data);
  res.json(newProduct);
});

// ---- produk: ubah ----
app.put("/api/products/:id", requireLogin, async (req, res) => {
  const data = await readData();
  data.products = data.products.map((p) =>
    p.id === req.params.id ? { ...p, ...req.body } : p
  );
  await writeData(data);
  res.json({ ok: true });
});

// ---- produk: hapus ----
app.delete("/api/products/:id", requireLogin, async (req, res) => {
  const data = await readData();
  data.products = data.products.filter((p) => p.id !== req.params.id);
  await writeData(data);
  res.json({ ok: true });
});

// ---- transaksi: checkout (simpan penjualan baru) ----
app.post("/api/transactions", requireLogin, async (req, res) => {
  const data = await readData();
  const items = req.body.items || [];

  // cek dulu stok masing-masing item cukup atau tidak, sebelum ada yang disimpan
  for (const item of items) {
    const product = data.products.find((p) => p.id === item.id);
    const stokTersedia = product ? (product.stock ?? 0) : 0;
    if (!product || stokTersedia < item.qty) {
      return res.status(400).json({ error: `Stok "${item.name}" tidak cukup (sisa ${stokTersedia})` });
    }
  }

  // stok cukup semua, kurangi stok tiap produk yang terjual
  items.forEach((item) => {
    const product = data.products.find((p) => p.id === item.id);
    product.stock = (product.stock ?? 0) - item.qty;
  });

  const trx = {
    id: `t_${Date.now()}`,
    timestamp: new Date().toISOString(),
    items,
    total: req.body.total,
  };
  data.transactions.unshift(trx);
  await writeData(data);
  res.json(trx);
});

// ---- transaksi: hapus (untuk koreksi kesalahan input) ----
app.delete("/api/transactions/:id", requireLogin, async (req, res) => {
  const data = await readData();
  const trx = data.transactions.find((t) => t.id === req.params.id);

  // kembalikan stok produk yang ada di transaksi yang dihapus
  if (trx) {
    trx.items.forEach((item) => {
      const product = data.products.find((p) => p.id === item.id);
      if (product) product.stock = (product.stock ?? 0) + item.qty;
    });
  }

  data.transactions = data.transactions.filter((t) => t.id !== req.params.id);
  await writeData(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toko online kamu jalan di http://localhost:${PORT}`);
});
