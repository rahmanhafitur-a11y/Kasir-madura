import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Sampoerna Mild", category: "Rokok", price: 30000 },
  { id: "p2", name: "Gudang Garam Filter", category: "Rokok", price: 25000 },
  { id: "p3", name: "Djarum Super", category: "Rokok", price: 27000 },
  { id: "p4", name: "Air Mineral 600ml", category: "Minuman", price: 4000 },
  { id: "p5", name: "Teh Botol", category: "Minuman", price: 5000 },
  { id: "p6", name: "Kopi Sachet", category: "Minuman", price: 2000 },
  { id: "p7", name: "Indomie Goreng", category: "Snack", price: 3500 },
  { id: "p8", name: "Chitato", category: "Snack", price: 11000 },
  { id: "p9", name: "Beras 1kg", category: "Sembako", price: 14000 },
  { id: "p10", name: "Minyak Goreng 1L", category: "Sembako", price: 18000 },
  { id: "p11", name: "Telur 1kg", category: "Sembako", price: 28000 },
  { id: "p12", name: "Gula 1kg", category: "Sembako", price: 16000 },
  { id: "p13", name: "Pulsa 10rb", category: "Pulsa/Token", price: 11000 },
  { id: "p14", name: "Token Listrik 20rb", category: "Pulsa/Token", price: 21000 },
  { id: "p15", name: "Gas LPG 3kg", category: "Lainnya", price: 22000 },
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
app.get("/api/data", async (req, res) => {
  const data = await readData();
  res.json(data);
});

// ---- produk: tambah ----
app.post("/api/products", async (req, res) => {
  const data = await readData();
  const newProduct = { id: `p_${Date.now()}`, ...req.body };
  data.products.push(newProduct);
  await writeData(data);
  res.json(newProduct);
});

// ---- produk: ubah ----
app.put("/api/products/:id", async (req, res) => {
  const data = await readData();
  data.products = data.products.map((p) =>
    p.id === req.params.id ? { ...p, ...req.body } : p
  );
  await writeData(data);
  res.json({ ok: true });
});

// ---- produk: hapus ----
app.delete("/api/products/:id", async (req, res) => {
  const data = await readData();
  data.products = data.products.filter((p) => p.id !== req.params.id);
  await writeData(data);
  res.json({ ok: true });
});

// ---- transaksi: checkout (simpan penjualan baru) ----
app.post("/api/transactions", async (req, res) => {
  const data = await readData();
  const trx = {
    id: `t_${Date.now()}`,
    timestamp: new Date().toISOString(),
    items: req.body.items,
    total: req.body.total,
  };
  data.transactions.unshift(trx);
  await writeData(data);
  res.json(trx);
});

// ---- transaksi: hapus (untuk koreksi kesalahan input) ----
app.delete("/api/transactions/:id", async (req, res) => {
  const data = await readData();
  data.transactions = data.transactions.filter((t) => t.id !== req.params.id);
  await writeData(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toko online kamu jalan di http://localhost:${PORT}`);
});
