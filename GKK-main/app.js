/* ═══════════════════════════════════════════
   GKK 2.0 — App Logic
   Gumasta Krishi Kendra
═══════════════════════════════════════════ */

// ── DATA STORE ──────────────────────────────
const DB = {
  get: (k, def=[]) => { try { const v = localStorage.getItem('gkk_'+k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem('gkk_'+k, JSON.stringify(v)); } catch(e) { toast('Storage full!'); } },
  getObj: (k, def={}) => { try { const v = localStorage.getItem('gkk_'+k); return v ? JSON.parse(v) : def; } catch { return def; } }
};

// ── INIT ─────────────────────────────────────
window.addEventListener('load', () => {
  // Splash
  setTimeout(() => { document.getElementById('splash').classList.add('hidden'); init(); }, 1800);
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});

function init() {
  updateSidebarDate();
  updateDashboardGreeting();
  renderDashboard();
  renderPOSProducts();
  renderBadges();
  loadSettings();
  setReportDates();
}

// ── NAVIGATION ──────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  closeSidebar();

  const titles = {
    dashboard: ['Dashboard', 'आज का अवलोकन'],
    pos: ['New Bill', 'नया बिल बनाएं'],
    orders: ['Orders', 'सभी बिल'],
    products: ['Products', 'उत्पाद प्रबंधन'],
    stock: ['Stock', 'स्टॉक प्रबंधन'],
    returns: ['Returns', 'वापसी प्रबंधन'],
    ledger: ['Udhar Ledger', 'उधार खाता'],
    profitloss: ['Profit & Loss', 'लाभ और हानि'],
    reports: ['Reports', 'रिपोर्ट'],
    aiassist: ['AI Assistant', 'AI कृषि सहायक'],
    disease: ['Disease Scanner', 'फसल रोग पहचान'],
    settings: ['Settings', 'सेटिंग्स']
  };
  const t = titles[id] || [id, ''];
  document.getElementById('pg-title').textContent = t[0];
  document.getElementById('pg-sub').textContent = t[1];

  // Page-specific renders
  if (id === 'dashboard') renderDashboard();
  if (id === 'orders') renderOrders();
  if (id === 'products') renderProducts();
  if (id === 'stock') renderStock('all');
  if (id === 'ledger') renderLedger();
  if (id === 'profitloss') renderPL('today');
  if (id === 'reports') renderReports();
  if (id === 'returns') { renderReturns(); populateReturnProducts(); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function updateSidebarDate() {
  const now = new Date();
  const opts = { weekday:'long', day:'numeric', month:'long', year:'numeric' };
  document.getElementById('sb-date').textContent = now.toLocaleDateString('hi-IN', opts);
}

function updateDashboardGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'शुभ प्रभात! 🌅' : h < 17 ? 'नमस्ते! 🙏' : 'शुभ संध्या! 🌙';
  const settings = DB.getObj('settings', {});
  const name = settings.owner ? ` ${settings.owner}` : '';
  document.getElementById('dash-greeting').textContent = g + (name ? ` ${name} जी` : '');
}

// ── DASHBOARD ───────────────────────────────
function renderDashboard() {
  const bills = DB.get('bills');
  const products = DB.get('products');
  const udhars = DB.get('udhar');
  const today = todayStr();

  const todayBills = bills.filter(b => b.date === today);
  const todaySale = todayBills.reduce((s, b) => s + b.total, 0);
  const todayProfit = todayBills.reduce((s, b) => s + (b.profit || 0), 0);
  const margin = todaySale > 0 ? ((todayProfit / todaySale) * 100).toFixed(1) : 0;

  set('d-today-sale', '₹' + fmt(todaySale));
  set('d-total-products', products.length);
  set('d-today-bills', todayBills.length);
  set('d-today-profit', '₹' + fmt(todayProfit));
  set('d-profit-margin', `Margin: ${margin}%`);

  const lowStock = products.filter(p => {
    const s = DB.getObj('settings', {});
    return (p.stock || 0) <= (s.lowstock || 10) && (p.stock || 0) > 0;
  });
  const outOfStock = products.filter(p => (p.stock || 0) <= 0);
  set('d-low-stock', lowStock.length + outOfStock.length);

  const totalUdhar = udhars.reduce((s, u) => s + (u.amount - (u.paid || 0)), 0);
  set('d-udhar', '₹' + fmt(totalUdhar));
  set('d-udhar-count', udhars.length + ' customers');

  // Low stock section
  const lowAll = [...outOfStock, ...lowStock].slice(0, 5);
  if (lowAll.length > 0) {
    document.getElementById('low-stock-section').style.display = 'block';
    document.getElementById('low-stock-list').innerHTML = lowAll.map(p =>
      `<div class="low-stock-item"><span class="lsi-name">${p.name}</span><span class="lsi-stock">${p.stock <= 0 ? 'OUT' : p.stock + ' ' + p.unit}</span></div>`
    ).join('');
  }

  // Recent bills
  const recent = [...bills].sort((a, b) => b.id - a.id).slice(0, 5);
  document.getElementById('recent-bills-list').innerHTML = recent.length ? recent.map(b =>
    `<div class="bill-item" onclick="openBillDetail(${b.id})">
      <div><div class="bill-num">Bill #${b.id} • ${b.date}</div><div class="bill-customer">${b.customer || 'Walk-in Customer'}</div></div>
      <div style="text-align:right"><div class="bill-amt">₹${fmt(b.total)}</div><span class="bill-pay-badge pay-${b.payMode}">${b.payMode.toUpperCase()}</span></div>
    </div>`
  ).join('') : '<div class="empty-state">कोई बिल नहीं। पहला बिल बनाएं! 🧾</div>';

  // Udhar
  const topUdhar = udhars.filter(u => (u.amount - (u.paid || 0)) > 0).sort((a, b) => (b.amount - (b.paid||0)) - (a.amount - (a.paid||0))).slice(0, 3);
  document.getElementById('dash-udhar-list').innerHTML = topUdhar.length ? topUdhar.map(u =>
    `<div class="udhar-item"><div><div class="ui-name">${u.name}</div><div style="font-size:11px;color:var(--muted)">${u.phone || 'No phone'}</div></div><div class="ui-amt">₹${fmt(u.amount - (u.paid||0))}</div></div>`
  ).join('') : '<div class="empty-state">कोई उधार नहीं। 👍</div>';

  renderBadges();
}

function renderBadges() {
  const bills = DB.get('bills');
  const products = DB.get('products');
  const settings = DB.getObj('settings', {});
  const lowCount = products.filter(p => (p.stock||0) <= (settings.lowstock||10)).length;
  const el = document.getElementById('nb-stock');
  if (el) { el.textContent = lowCount; el.style.display = lowCount > 0 ? '' : 'none'; }
  const ob = document.getElementById('nb-orders');
  if (ob) ob.textContent = bills.length;
}

// ── POS ─────────────────────────────────────
let cart = [];
let posCategory = 'all';

function renderPOSProducts(filter='', cat='all') {
  const products = DB.get('products').filter(p => (p.stock||0) > 0);
  const cats = ['all', ...new Set(products.map(p => p.category))];

  document.getElementById('pos-cat-pills').innerHTML = cats.map(c =>
    `<div class="cat-pill ${c === cat ? 'active' : ''}" onclick="posFilterCat('${c}')">${c === 'all' ? '🌾 All' : c}</div>`
  ).join('');

  const filtered = products.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (p.name.toLowerCase().includes(filter.toLowerCase()) || (p.company||'').toLowerCase().includes(filter.toLowerCase()))
  );

  document.getElementById('pos-product-grid').innerHTML = filtered.length ? filtered.map(p =>
    `<div class="pos-prod-card" onclick="addToCart(${p.id})">
      <div class="ppc-cat">${p.category}</div>
      <div class="ppc-name">${p.name}</div>
      <div class="ppc-bottom">
        <span class="ppc-price">₹${fmt(p.sellPrice)}</span>
        <span class="ppc-stock ${(p.stock||0) <= 5 ? 'low' : ''}">${p.stock} ${p.unit}</span>
        <button class="ppc-add">+</button>
      </div>
    </div>`
  ).join('') : `<div class="empty-state" style="grid-column:1/-1">No products found</div>`;
}

function posSearch(v) { renderPOSProducts(v, posCategory); }
function posFilterCat(c) { posCategory = c; renderPOSProducts(document.getElementById('pos-search').value, c); }

function addToCart(id) {
  const products = DB.get('products');
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= prod.stock) { toast('Stock limit reached!'); return; }
    existing.qty++;
  } else {
    cart.push({ id, name: prod.name, qty: 1, price: prod.sellPrice, buyPrice: prod.buyPrice, unit: prod.unit });
  }
  renderCart();
  toast(`${prod.name} added ✓`);
}

function renderCart() {
  const items = document.getElementById('cart-items');
  if (cart.length === 0) {
    items.innerHTML = '<div class="empty-cart">Cart is empty<br>उत्पाद जोड़ें</div>';
  } else {
    items.innerHTML = cart.map((c, i) =>
      `<div class="cart-item">
        <span class="ci-name">${c.name}</span>
        <div class="ci-qty-ctrl">
          <button class="ci-qty-btn" onclick="changeQty(${i},-1)">−</button>
          <span class="ci-qty">${c.qty}</span>
          <button class="ci-qty-btn" onclick="changeQty(${i},1)">+</button>
        </div>
        <span class="ci-price">₹${fmt(c.price * c.qty)}</span>
        <button class="ci-remove" onclick="removeFromCart(${i})">✕</button>
      </div>`
    ).join('');
  }
  calcCart();
}

function changeQty(i, d) {
  cart[i].qty = Math.max(1, cart[i].qty + d);
  renderCart();
}
function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}
function clearCart() {
  cart = [];
  document.getElementById('cart-discount').value = 0;
  renderCart();
}

function calcCart() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
  const total = subtotal * (1 - discount / 100);
  const cost = cart.reduce((s, c) => s + (c.buyPrice || 0) * c.qty, 0);
  const profit = total - cost;

  set('cart-subtotal', '₹' + fmt(subtotal));
  set('cart-total', '₹' + fmt(total));
  set('cart-profit', '₹' + fmt(profit));
}

function finalizeBill(payMode) {
  if (cart.length === 0) { toast('Cart is empty! उत्पाद जोड़ें'); return; }
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
  const total = subtotal * (1 - discount / 100);
  const cost = cart.reduce((s, c) => s + (c.buyPrice || 0) * c.qty, 0);
  const profit = total - cost;
  const customer = document.getElementById('cart-customer').value || '';

  const bills = DB.get('bills');
  const id = bills.length > 0 ? Math.max(...bills.map(b => b.id)) + 1 : 1;
  const bill = {
    id, customer, payMode, subtotal, discount, total, profit, cost,
    items: [...cart], date: todayStr(), time: new Date().toLocaleTimeString('hi-IN'), ts: Date.now()
  };
  bills.push(bill);
  DB.set('bills', bills);

  // Deduct stock
  const products = DB.get('products');
  cart.forEach(ci => {
    const p = products.find(p => p.id === ci.id);
    if (p) p.stock = Math.max(0, (p.stock || 0) - ci.qty);
  });
  DB.set('products', products);

  // If udhar, add to ledger
  if (payMode === 'udhar' && customer) {
    const udhars = DB.get('udhar');
    const existing = udhars.find(u => u.name.toLowerCase() === customer.toLowerCase());
    if (existing) {
      existing.amount += total;
      existing.history = existing.history || [];
      existing.history.push({ date: todayStr(), amt: total, billId: id });
    } else {
      udhars.push({ id: Date.now(), name: customer, phone: '', amount: total, paid: 0, date: todayStr(), history: [{ date: todayStr(), amt: total, billId: id }] });
    }
    DB.set('udhar', udhars);
  }

  clearCart();
  document.getElementById('cart-customer').value = '';
  renderPOSProducts();
  renderBadges();
  toast(`Bill #${id} saved! ₹${fmt(total)} • ${payMode.toUpperCase()} ✓`);
}

// ── PRODUCTS ─────────────────────────────────
function renderProducts() {
  const products = DB.get('products');
  const search = (document.getElementById('prod-search')?.value || '').toLowerCase();
  const cat = document.getElementById('prod-cat')?.value || 'all';

  // Populate category filter
  const cats = ['all', ...new Set(products.map(p => p.category))];
  const catEl = document.getElementById('prod-cat');
  if (catEl) {
    catEl.innerHTML = cats.map(c => `<option value="${c}">${c === 'all' ? 'All Categories' : c}</option>`).join('');
    catEl.value = cat;
  }

  const filtered = products.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (p.name.toLowerCase().includes(search) || (p.company||'').toLowerCase().includes(search))
  );

  const settings = DB.getObj('settings', {});
  const lowLevel = settings.lowstock || 10;

  document.getElementById('products-list').innerHTML = filtered.length ? filtered.map(p => {
    const margin = p.buyPrice > 0 ? (((p.sellPrice - p.buyPrice) / p.buyPrice) * 100).toFixed(1) : 0;
    const stockClass = (p.stock||0) <= 0 ? 'stock-out' : (p.stock||0) <= lowLevel ? 'stock-low' : 'stock-ok';
    const stockLabel = (p.stock||0) <= 0 ? 'OUT' : (p.stock||0) <= lowLevel ? `LOW: ${p.stock}` : p.stock;
    return `<div class="product-card">
      <div class="pc-left">
        <div class="pc-cat">${p.category}</div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-company">${p.company || ''}</div>
        <div class="pc-prices">
          <span class="pc-buy">Cost: ₹${fmt(p.buyPrice)}</span>
          <span class="pc-sell">Sell: ₹${fmt(p.sellPrice)}</span>
          <span class="pc-margin">+${margin}%</span>
        </div>
        ${p.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${p.notes}</div>` : ''}
      </div>
      <div class="pc-right">
        <span class="pc-stock-badge ${stockClass}">${stockLabel} ${p.unit}</span>
        <div class="pc-actions">
          <button class="pc-btn edit" onclick="openEditProduct(${p.id})">✏️</button>
          <button class="pc-btn del" onclick="deleteProduct(${p.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No products found. Add your first product! 📦</div>';
}

function openAddProduct() {
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-buy').value = '';
  document.getElementById('prod-sell').value = '';
  document.getElementById('prod-stock').value = '';
  document.getElementById('prod-company').value = '';
  document.getElementById('prod-notes').value = '';
  document.getElementById('margin-preview').textContent = 'Margin: 0%';
  document.getElementById('modal-product-title').textContent = 'Add Product / उत्पाद जोड़ें';
  openModal('modal-product');
}

function openEditProduct(id) {
  const p = DB.get('products').find(p => p.id === id);
  if (!p) return;
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-buy').value = p.buyPrice;
  document.getElementById('prod-sell').value = p.sellPrice;
  document.getElementById('prod-stock').value = p.stock || 0;
  document.getElementById('prod-company').value = p.company || '';
  document.getElementById('prod-notes').value = p.notes || '';
  document.getElementById('modal-product-title').textContent = 'Edit Product / संपादित करें';
  updateMarginPreview();
  openModal('modal-product');
}

function updateMarginPreview() {
  const buy = parseFloat(document.getElementById('prod-buy').value) || 0;
  const sell = parseFloat(document.getElementById('prod-sell').value) || 0;
  if (buy > 0 && sell > 0) {
    const margin = (((sell - buy) / buy) * 100).toFixed(1);
    const profit = sell - buy;
    document.getElementById('margin-preview').textContent = `Margin: ${margin}% | Profit per unit: ₹${fmt(profit)}`;
    document.getElementById('margin-preview').style.color = profit >= 0 ? 'var(--green-mid)' : 'var(--red)';
  }
}

function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  if (!name) { toast('Product name required!'); return; }
  const buyPrice = parseFloat(document.getElementById('prod-buy').value) || 0;
  const sellPrice = parseFloat(document.getElementById('prod-sell').value) || 0;
  if (buyPrice <= 0 || sellPrice <= 0) { toast('Enter valid prices!'); return; }

  const products = DB.get('products');
  const existingId = document.getElementById('prod-id').value;

  const prod = {
    name, buyPrice, sellPrice,
    category: document.getElementById('prod-category').value,
    unit: document.getElementById('prod-unit').value,
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    company: document.getElementById('prod-company').value,
    notes: document.getElementById('prod-notes').value
  };

  if (existingId) {
    const idx = products.findIndex(p => p.id == existingId);
    if (idx !== -1) { prod.id = parseInt(existingId); products[idx] = prod; }
  } else {
    prod.id = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push(prod);
  }

  DB.set('products', products);
  closeModal('modal-product');
  renderProducts();
  renderPOSProducts();
  toast('Product saved! ✓');
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const products = DB.get('products').filter(p => p.id !== id);
  DB.set('products', products);
  renderProducts();
  renderPOSProducts();
  toast('Product deleted');
}

// ── STOCK ─────────────────────────────────────
function stockTab(type, el) {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderStock(type);
}

function renderStock(type) {
  const products = DB.get('products');
  const settings = DB.getObj('settings', {});
  const lowLevel = settings.lowstock || 10;
  let filtered = products;
  if (type === 'low') filtered = products.filter(p => (p.stock||0) > 0 && (p.stock||0) <= lowLevel);
  if (type === 'out') filtered = products.filter(p => (p.stock||0) <= 0);

  document.getElementById('stock-list').innerHTML = filtered.length ? filtered.map(p =>
    `<div class="stock-row">
      <div class="sr-name">${p.name} <span class="sr-unit">(${p.unit})</span></div>
      <div class="sr-edit">
        <input type="number" class="sr-qty-input" value="${p.stock||0}" id="sq-${p.id}" min="0">
        <button class="sr-save" onclick="updateStock(${p.id})">Save</button>
      </div>
    </div>`
  ).join('') : '<div class="empty-state">No products in this category</div>';
}

function updateStock(id) {
  const newQty = parseInt(document.getElementById('sq-' + id).value) || 0;
  const products = DB.get('products');
  const p = products.find(p => p.id === id);
  if (p) { p.stock = newQty; DB.set('products', products); renderBadges(); toast('Stock updated ✓'); }
}

// ── ORDERS ─────────────────────────────────────
function renderOrders() {
  let bills = DB.get('bills');
  const search = (document.getElementById('order-search')?.value || '').toLowerCase();
  const period = document.getElementById('order-filter')?.value || 'all';
  const payF = document.getElementById('pay-filter')?.value || 'all';
  const today = todayStr();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

  if (period === 'today') bills = bills.filter(b => b.date === today);
  else if (period === 'week') bills = bills.filter(b => new Date(b.date) >= weekAgo);
  else if (period === 'month') bills = bills.filter(b => new Date(b.date) >= monthAgo);
  if (payF !== 'all') bills = bills.filter(b => b.payMode === payF);
  if (search) bills = bills.filter(b => (b.customer||'').toLowerCase().includes(search) || String(b.id).includes(search));

  bills = [...bills].sort((a, b) => b.ts - a.ts);

  // Summary
  const totalRev = bills.reduce((s, b) => s + b.total, 0);
  const totalProfit = bills.reduce((s, b) => s + (b.profit || 0), 0);
  document.getElementById('orders-summary').innerHTML = `
    <div class="os-card"><div class="os-val">${bills.length}</div><div class="os-lbl">Bills</div></div>
    <div class="os-card"><div class="os-val">₹${fmt(totalRev)}</div><div class="os-lbl">Revenue</div></div>
    <div class="os-card"><div class="os-val">₹${fmt(totalProfit)}</div><div class="os-lbl">Profit</div></div>
  `;

  document.getElementById('orders-list').innerHTML = bills.length ? bills.map(b =>
    `<div class="bill-item" onclick="openBillDetail(${b.id})">
      <div>
        <div class="bill-num">Bill #${b.id} • ${b.date} ${b.time || ''}</div>
        <div class="bill-customer">${b.customer || 'Walk-in Customer'}</div>
        <div style="font-size:11px;color:var(--muted)">${b.items?.length || 0} items</div>
      </div>
      <div style="text-align:right">
        <div class="bill-amt">₹${fmt(b.total)}</div>
        <span class="bill-pay-badge pay-${b.payMode}">${b.payMode?.toUpperCase()}</span>
      </div>
    </div>`
  ).join('') : '<div class="empty-state">No bills found</div>';
}

function openBillDetail(id) {
  const bill = DB.get('bills').find(b => b.id === id);
  if (!bill) return;
  const settings = DB.getObj('settings', {});
  document.getElementById('bill-detail-content').innerHTML = `
    <div class="bill-detail">
      <div class="bd-header">
        <div class="bd-shop">🌿 ${settings.shopName || 'Gumasta Krishi Kendra'}</div>
        <div style="font-size:12px;color:var(--muted)">${settings.address || ''}</div>
        <div style="font-size:12px;margin-top:4px">Bill #${bill.id} | ${bill.date} ${bill.time||''}</div>
      </div>
      <div style="margin-bottom:8px"><strong>Customer:</strong> ${bill.customer || 'Walk-in'}</div>
      <table class="bd-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${(bill.items||[]).map(i => `<tr><td>${i.name}</td><td>${i.qty} ${i.unit||''}</td><td>₹${fmt(i.price)}</td><td>₹${fmt(i.price*i.qty)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>₹${fmt(bill.subtotal)}</span></div>
        ${bill.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--red)"><span>Discount (${bill.discount}%):</span><span>-₹${fmt(bill.subtotal * bill.discount/100)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between" class="bd-total"><span>TOTAL:</span><span>₹${fmt(bill.total)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px"><span>Payment:</span><span class="bill-pay-badge pay-${bill.payMode}">${bill.payMode?.toUpperCase()}</span></div>
      </div>
    </div>
  `;
  openModal('modal-bill');
}

window.printBill = function() {
  const content = document.getElementById('bill-detail-content').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<html><body><style>body{font-family:sans-serif;max-width:300px;margin:0 auto;padding:16px}.bd-shop{font-size:18px;font-weight:800}.bd-table{width:100%;border-collapse:collapse}.bd-table th,.bd-table td{border-bottom:1px solid #eee;padding:4px 0;font-size:12px}.bd-total{font-weight:800;font-size:15px}.bill-pay-badge{padding:2px 8px;border-radius:99px;font-size:11px}</style>${content}</body></html>`);
  win.document.close();
  win.print();
};

// ── LEDGER / UDHAR ───────────────────────────
function renderLedger() {
  const udhars = DB.get('udhar');
  const search = (document.getElementById('ledger-search')?.value || '').toLowerCase();
  const filtered = udhars.filter(u => u.name.toLowerCase().includes(search));
  const totalAmt = udhars.reduce((s, u) => s + Math.max(0, u.amount - (u.paid||0)), 0);

  set('total-udhar-amt', '₹' + fmt(totalAmt));
  set('total-udhar-customers', udhars.filter(u => (u.amount-(u.paid||0)) > 0).length);

  document.getElementById('ledger-list').innerHTML = filtered.length ? filtered.map(u => {
    const pending = u.amount - (u.paid || 0);
    return `<div class="ledger-card">
      <div class="lc-top">
        <div><div class="lc-name">${u.name}</div><div class="lc-phone">${u.phone || 'No phone'}</div></div>
        <div style="text-align:right"><div class="lc-amt ${pending <= 0 ? 'green-text' : ''}">₹${fmt(Math.max(0, pending))}</div><div style="font-size:11px;color:var(--muted)">since ${u.date}</div></div>
      </div>
      <div class="lc-actions">
        ${pending > 0 ? `<button class="lc-btn pay" onclick="collectPayment(${u.id})">💵 Collect</button>` : '<span style="font-size:12px;color:var(--green-light);font-weight:700">✓ Paid</span>'}
        <button class="lc-btn del" onclick="deleteUdhar(${u.id})">Delete</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No udhar records</div>';
}

function openAddUdhar() { openModal('modal-udhar'); }

function saveUdhar() {
  const name = document.getElementById('udhar-name').value.trim();
  const amount = parseFloat(document.getElementById('udhar-amt').value) || 0;
  if (!name || amount <= 0) { toast('Name and amount required!'); return; }

  const udhars = DB.get('udhar');
  const existing = udhars.find(u => u.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.amount += amount;
  } else {
    udhars.push({ id: Date.now(), name, phone: document.getElementById('udhar-phone').value, amount, paid: 0, date: todayStr(), history: [] });
  }
  DB.set('udhar', udhars);
  closeModal('modal-udhar');
  renderLedger();
  toast('Udhar recorded ✓');
}

function collectPayment(id) {
  const udhars = DB.get('udhar');
  const u = udhars.find(u => u.id === id);
  if (!u) return;
  const pending = u.amount - (u.paid || 0);
  const amt = prompt(`Collect from ${u.name} (Pending: ₹${fmt(pending)})\nEnter amount collected:`, pending);
  if (!amt) return;
  u.paid = (u.paid || 0) + parseFloat(amt);
  DB.set('udhar', udhars);
  renderLedger();
  toast(`₹${fmt(parseFloat(amt))} collected from ${u.name} ✓`);
}

function deleteUdhar(id) {
  if (!confirm('Delete this udhar record?')) return;
  DB.set('udhar', DB.get('udhar').filter(u => u.id !== id));
  renderLedger();
  toast('Record deleted');
}

// ── RETURNS ─────────────────────────────────
function populateReturnProducts() {
  const products = DB.get('products');
  const sel = document.getElementById('ret-product');
  if (sel) sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function processReturn() {
  const productId = parseInt(document.getElementById('ret-product').value);
  const qty = parseInt(document.getElementById('ret-qty').value) || 0;
  if (qty <= 0) { toast('Enter valid quantity!'); return; }

  const returns = DB.get('returns');
  returns.push({
    id: Date.now(), productId, qty,
    billNum: document.getElementById('ret-bill').value,
    customer: document.getElementById('ret-customer').value,
    reason: document.getElementById('ret-reason').value,
    date: todayStr()
  });
  DB.set('returns', returns);

  // Restock
  const products = DB.get('products');
  const p = products.find(p => p.id === productId);
  if (p) { p.stock = (p.stock || 0) + qty; DB.set('products', products); }

  document.getElementById('ret-bill').value = '';
  document.getElementById('ret-customer').value = '';
  document.getElementById('ret-qty').value = '';
  renderReturns();
  toast('Return processed. Stock updated ✓');
}

function renderReturns() {
  const returns = DB.get('returns');
  const products = DB.get('products');
  document.getElementById('returns-list').innerHTML = returns.length ? [...returns].reverse().map(r => {
    const p = products.find(p => p.id === r.productId);
    return `<div class="return-item">
      <div class="ri-top"><span class="ri-name">${p?.name || 'Unknown'} × ${r.qty}</span><span class="ri-date">${r.date}</span></div>
      <div style="font-size:12px;color:var(--muted)">${r.customer ? `Customer: ${r.customer} | ` : ''}${r.billNum ? `Bill: ${r.billNum} | ` : ''}</div>
      <div class="ri-reason">${r.reason}</div>
    </div>`;
  }).join('') : '<div class="empty-state">No returns yet</div>';
}

// ── PROFIT & LOSS ────────────────────────────
let currentPLPeriod = 'today';

function plPeriod(p, el) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentPLPeriod = p;
  renderPL(p);
}

function renderPL(period) {
  let bills = DB.get('bills');
  const today = todayStr();
  if (period === 'today') bills = bills.filter(b => b.date === today);
  else if (period === 'week') { const w = new Date(); w.setDate(w.getDate()-7); bills = bills.filter(b => new Date(b.date) >= w); }
  else if (period === 'month') { const m = new Date(); m.setDate(m.getDate()-30); bills = bills.filter(b => new Date(b.date) >= m); }

  const revenue = bills.reduce((s, b) => s + b.total, 0);
  const cost = bills.reduce((s, b) => s + (b.cost || 0), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
  const avgBill = bills.length > 0 ? revenue / bills.length : 0;

  const returns = DB.get('returns');
  const products = DB.get('products');
  const returnLoss = returns.reduce((s, r) => {
    const p = products.find(p => p.id === r.productId);
    return s + ((p?.buyPrice || 0) * r.qty);
  }, 0);

  set('pl-revenue', '₹' + fmt(revenue));
  set('pl-cost', '₹' + fmt(cost));
  const profEl = document.getElementById('pl-profit');
  profEl.textContent = '₹' + fmt(profit);
  profEl.style.color = profit >= 0 ? '#86efac' : '#fca5a5';
  set('pl-margin', margin + '%');
  set('pl-bills', bills.length);
  set('pl-avg', '₹' + fmt(avgBill));
  set('pl-returns-loss', '₹' + fmt(returnLoss));

  // Top products
  const prodSales = {};
  bills.forEach(b => b.items?.forEach(i => {
    if (!prodSales[i.name]) prodSales[i.name] = { qty: 0, revenue: 0 };
    prodSales[i.name].qty += i.qty;
    prodSales[i.name].revenue += i.price * i.qty;
  }));
  const topProds = Object.entries(prodSales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  document.getElementById('pl-top-products').innerHTML = topProds.length ? topProds.map(([name, d]) =>
    `<div class="top-product-row"><div><div class="tpr-name">${name}</div><div class="tpr-sold">${d.qty} units sold</div></div><div class="tpr-revenue">₹${fmt(d.revenue)}</div></div>`
  ).join('') : '<div class="empty-state">No sales data yet</div>';
}

function calcProfit() {
  const buy = parseFloat(document.getElementById('calc-buy').value) || 0;
  const sell = parseFloat(document.getElementById('calc-sell').value) || 0;
  const qty = parseFloat(document.getElementById('calc-qty').value) || 1;
  const profit = (sell - buy) * qty;
  const margin = buy > 0 ? (((sell - buy) / buy) * 100).toFixed(1) : 0;
  set('cr-profit', '₹' + fmt(profit));
  set('cr-margin', margin + '%');
  set('cr-total', '₹' + fmt(sell * qty));
  document.getElementById('cr-profit').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
}

// ── REPORTS ─────────────────────────────────
function setReportDates() {
  const today = todayStr();
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const el1 = document.getElementById('rep-from');
  const el2 = document.getElementById('rep-to');
  if (el1) el1.value = monthAgo.toISOString().split('T')[0];
  if (el2) el2.value = today;
}

function renderReports() {
  const from = document.getElementById('rep-from')?.value;
  const to = document.getElementById('rep-to')?.value;
  if (!from || !to) return;

  const bills = DB.get('bills').filter(b => b.date >= from && b.date <= to);
  const revenue = bills.reduce((s, b) => s + b.total, 0);
  const profit = bills.reduce((s, b) => s + (b.profit || 0), 0);

  // Group by date
  const byDate = {};
  bills.forEach(b => { byDate[b.date] = byDate[b.date] || { revenue: 0, profit: 0, count: 0 }; byDate[b.date].revenue += b.total; byDate[b.date].profit += (b.profit||0); byDate[b.date].count++; });

  document.getElementById('reports-content').innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-info"><div class="stat-val">₹${fmt(revenue)}</div><div class="stat-lbl">Total Revenue</div></div></div>
      <div class="stat-card blue"><div class="stat-icon">📈</div><div class="stat-info"><div class="stat-val">₹${fmt(profit)}</div><div class="stat-lbl">Total Profit</div></div></div>
      <div class="stat-card orange"><div class="stat-icon">🧾</div><div class="stat-info"><div class="stat-val">${bills.length}</div><div class="stat-lbl">Total Bills</div></div></div>
      <div class="stat-card red"><div class="stat-icon">📊</div><div class="stat-info"><div class="stat-val">${revenue > 0 ? ((profit/revenue)*100).toFixed(1) : 0}%</div><div class="stat-lbl">Profit Margin</div></div></div>
    </div>
    <div class="card">
      <div class="card-title">Daily Breakdown</div>
      ${Object.entries(byDate).sort((a,b) => b[0].localeCompare(a[0])).map(([date, d]) =>
        `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div><div style="font-weight:600">${date}</div><div style="color:var(--muted);font-size:11px">${d.count} bills</div></div>
          <div style="text-align:right"><div style="font-weight:700;color:var(--green)">₹${fmt(d.revenue)}</div><div style="font-size:11px;color:var(--muted)">Profit: ₹${fmt(d.profit)}</div></div>
        </div>`
      ).join('') || '<div class="empty-state">No data</div>'}
    </div>
  `;
}

// ── AI ASSISTANT ─────────────────────────────
async function sendAI() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  appendAIMsg(msg, 'user');
  const typingId = appendTyping();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are an expert agricultural advisor for an Indian farm supply shop called "Gumasta Krishi Kendra" in Madhya Pradesh, India. You help the shopkeeper answer farmers' questions about:
- Seeds (बीज): varieties, sowing time, spacing, germination
- Fertilizers (खाद): NPK, urea, DAP, MOP - doses per acre, timing, method
- Pesticides/Insecticides (कीटनाशक): which product for which pest, dose per liter water, spray timing, safety
- Herbicides (खरपतवार नाशक): which weed, dose, timing
- Crop diseases: diagnosis and recommended products with doses
- Per acre quantities, water mixing ratios, application methods

Always respond in a mix of Hindi and English (Hinglish) as that's natural for MP farmers. Be specific with doses (e.g., "2ml per liter water", "5kg per acre"). Format with bullet points. Be practical and concise. If recommending a product, mention how to use it safely.`,
        messages: [{ role: 'user', content: msg }]
      })
    });
    const data = await response.json();
    removeTyping(typingId);
    const reply = data.content?.[0]?.text || 'Sorry, कोई जवाब नहीं मिला।';
    appendAIMsg(reply, 'bot');
  } catch(e) {
    removeTyping(typingId);
    appendAIMsg('❌ Connection error. Please check internet and try again.\n\nइंटरनेट जांचें और फिर कोशिश करें।', 'bot');
  }
}

function aiQuick(q) {
  document.getElementById('ai-input').value = q;
  sendAI();
}

function appendAIMsg(text, role) {
  const chat = document.getElementById('ai-chat');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.innerHTML = `
    <div class="ai-avatar">${role === 'bot' ? '🌿' : '👨'}</div>
    <div class="ai-bubble">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/•/g, '•')}</div>
  `;
  chat.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
  return div;
}

function appendTyping() {
  const chat = document.getElementById('ai-chat');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'ai-msg bot';
  div.id = id;
  div.innerHTML = `<div class="ai-avatar">🌿</div><div class="ai-bubble"><div class="ai-typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  chat.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── DISEASE SCANNER ──────────────────────────
async function scanDisease(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    const mediaType = file.type;

    document.getElementById('disease-preview').style.display = 'block';
    document.getElementById('disease-img-preview').src = e.target.result;
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('disease-result').style.display = 'block';
    document.getElementById('dr-loading').style.display = 'flex';
    document.getElementById('dr-content').style.display = 'none';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are an expert plant pathologist and agricultural advisor for farmers in Madhya Pradesh, India. When shown an image of a diseased crop or plant, you:
1. Identify the disease or problem
2. Recommend specific products available in Indian agri shops with exact doses
3. Explain how to apply (spray/drip/soil), timing, water ratio, and per acre quantity
4. Give safety precautions
Respond in Hinglish (Hindi + English mix). Be specific and practical. Use bullet points. Format clearly.`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'इस फसल/पौधे में क्या रोग/समस्या है? कौन सी दवाई उपयोग करें, कितनी मात्रा, कैसे? (What disease/problem is in this crop? Which product to use, what dose, how to apply?)' }
            ]
          }]
        })
      });
      const data = await response.json();
      document.getElementById('dr-loading').style.display = 'none';
      document.getElementById('dr-content').style.display = 'block';
      const reply = data.content?.[0]?.text || 'Could not analyze. Try a clearer photo.';
      document.getElementById('dr-content').innerHTML = `
        <div class="disease-result-title">🔬 AI Analysis Result</div>
        <div class="disease-result-body">${reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
      `;

      // Save to history
      const history = DB.get('disease_history');
      history.unshift({ date: todayStr(), result: reply.substring(0, 200) + '...' });
      DB.set('disease_history', history.slice(0, 10));
      renderDiseaseHistory();
    } catch(e) {
      document.getElementById('dr-loading').style.display = 'none';
      document.getElementById('dr-content').style.display = 'block';
      document.getElementById('dr-content').innerHTML = '<div style="color:var(--red)">❌ Error connecting to AI. Check internet and try again.</div>';
    }
  };
  reader.readAsDataURL(file);
}

function clearDiseaseScan() {
  document.getElementById('disease-preview').style.display = 'none';
  document.getElementById('disease-result').style.display = 'none';
  document.getElementById('upload-area').style.display = 'block';
  document.getElementById('disease-img').value = '';
}

function renderDiseaseHistory() {
  const history = DB.get('disease_history');
  const head = document.getElementById('disease-history-head');
  const list = document.getElementById('disease-history');
  if (history.length > 0 && head) head.style.display = 'block';
  if (list) list.innerHTML = history.map(h =>
    `<div class="card" style="font-size:13px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">${h.date}</div>${h.result}</div>`
  ).join('');
}

// ── SETTINGS ────────────────────────────────
function loadSettings() {
  const s = DB.getObj('settings', {});
  const fields = ['shopname', 'owner', 'phone', 'address', 'lowstock'];
  fields.forEach(f => {
    const el = document.getElementById('set-' + f);
    if (el && s[f]) el.value = s[f];
  });
}

function saveSettings() {
  const s = {
    shopName: document.getElementById('set-shopname').value,
    owner: document.getElementById('set-owner').value,
    phone: document.getElementById('set-phone').value,
    address: document.getElementById('set-address').value,
    lowstock: parseInt(document.getElementById('set-lowstock').value) || 10
  };
  DB.set('settings', s);
  const shopEl = document.querySelector('.sb-shop');
  if (shopEl && s.shopName) shopEl.textContent = s.shopName;
  toast('Settings saved ✓');
  updateDashboardGreeting();
}

function exportData() {
  const allData = {
    products: DB.get('products'),
    bills: DB.get('bills'),
    udhar: DB.get('udhar'),
    returns: DB.get('returns'),
    settings: DB.getObj('settings'),
    exported: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `GKK_backup_${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('Data exported ✓');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.products) DB.set('products', data.products);
      if (data.bills) DB.set('bills', data.bills);
      if (data.udhar) DB.set('udhar', data.udhar);
      if (data.returns) DB.set('returns', data.returns);
      if (data.settings) DB.set('settings', data.settings);
      toast('Data imported ✓ Reloading...');
      setTimeout(() => location.reload(), 1200);
    } catch { toast('Invalid file!'); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('⚠️ Delete ALL data? This cannot be undone!\n\nसभी डेटा मिटा दें?')) return;
  ['products','bills','udhar','returns','settings','disease_history'].forEach(k => localStorage.removeItem('gkk_'+k));
  toast('All data cleared');
  setTimeout(() => location.reload(), 1000);
}

// ── MODALS ───────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST ────────────────────────────────────
function toast(msg, dur=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── UTILS ────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmt(n) { return Number(n||0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
