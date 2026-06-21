const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");
const PROOF_UPLOAD_DIR = path.join(__dirname, "public", "uploads", "proofs");

const ORDER_STATUSES = ["pending", "processing", "done", "cancelled"];
const SERVICE_STATUSES = ["in_stock", "out_of_stock"];

const defaultServices = [
  {
    id: "selfbot",
    name: "Selfbot",
    price: "50k",
    description: "Dịch vụ hỗ trợ theo yêu cầu. Không yêu cầu khách nhập mật khẩu hoặc mã 2FA trên web.",
    status: "in_stock"
  },
  {
    id: "super-client",
    name: "Super Client",
    price: "50k / 2 tháng",
    description: "Gói Super Client sử dụng trong 2 tháng.",
    status: "in_stock"
  },
  {
    id: "buff-mem",
    name: "Buff Mem",
    price: "10k / 1 tháng",
    description: "Gói dịch vụ Buff Mem theo tháng.",
    status: "in_stock"
  }
];

const defaultAdmin = {
  username: "admin",
  password: "admin123"
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-order-test-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(PROOF_UPLOAD_DIR, { recursive: true });
      cb(null, PROOF_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, safeName);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    return cb(new Error("Chỉ chấp nhận file ảnh thanh toán."));
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROOF_UPLOAD_DIR)) {
    fs.mkdirSync(PROOF_UPLOAD_DIR, { recursive: true });
  }

  ensureJsonFile(SERVICES_FILE, defaultServices);
  ensureJsonFile(ORDERS_FILE, []);
  ensureJsonFile(ADMIN_FILE, defaultAdmin);
}

// JSON storage helpers keep the app lightweight and recover from empty/broken files.
function ensureJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, fallback);
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    writeJsonFile(filePath, fallback);
  }
}

function backupBrokenJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const backupPath = `${filePath}.broken-${Date.now()}.json`;
  try {
    fs.copyFileSync(filePath, backupPath);
  } catch (error) {
    console.warn(`Could not backup broken JSON: ${error.message}`);
  }
}

function readJsonFile(filePath, fallback) {
  try {
    ensureDataFiles();
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return clone(fallback);
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read ${path.basename(filePath)}: ${error.message}`);
    backupBrokenJson(filePath);
    writeJsonFile(filePath, fallback);
    return clone(fallback);
  }
}

function writeJsonFile(filePath, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const tempFile = `${filePath}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, filePath);
}

function getServices() {
  return readJsonFile(SERVICES_FILE, defaultServices);
}

function saveServices(services) {
  writeJsonFile(SERVICES_FILE, services);
}

function getOrders() {
  return readJsonFile(ORDERS_FILE, []);
}

function saveOrders(orders) {
  writeJsonFile(ORDERS_FILE, orders);
}

function getAdmin() {
  return readJsonFile(ADMIN_FILE, defaultAdmin);
}

function cleanInput(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function makeSlug(text) {
  const base = cleanInput(text, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `service-${Date.now()}`;
}

function generateOrderId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SO-${yyyy}${mm}${dd}-${random}`;
}

function getBaseUrl(req) {
  const host = req.get("host") || `localhost:${PORT}`;
  return `${req.protocol}://${host}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

function statusText(status) {
  const map = {
    in_stock: "Còn hàng",
    out_of_stock: "Hết hàng",
    pending: "Pending",
    processing: "Processing",
    done: "Done",
    cancelled: "Cancelled"
  };
  return map[status] || status;
}

function findService(id) {
  return getServices().find((service) => service.id === id);
}

// All admin pages pass through this session guard.
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect("/admin/login");
}

function renderWithLocals(res, view, locals = {}) {
  res.render(view, {
    shopName: "Super Order",
    currentYear: new Date().getFullYear(),
    formatDate,
    statusText,
    ORDER_STATUSES,
    SERVICE_STATUSES,
    ...locals
  });
}

// Discord webhook is optional; orders still save successfully if it is missing/fails.
async function sendDiscordWebhook(order) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const payload = {
    username: "Super Order",
    embeds: [
      {
        title: `Đơn hàng mới: ${order.id}`,
        color: 0x7c5cff,
        fields: [
          { name: "Mã đơn", value: order.id, inline: true },
          { name: "Tên khách", value: order.customerName || "Không có", inline: true },
          { name: "Discord", value: order.discord || "Không có", inline: true },
          { name: "Dịch vụ", value: order.serviceName || "Không có", inline: true },
          { name: "Giá", value: order.price || "Không có", inline: true },
          { name: "Ghi ch\u00fa", value: order.note || "Kh\u00f4ng c\u00f3", inline: false },
          { name: "\u1ea2nh thanh to\u00e1n", value: order.paymentProofUrl || "Kh\u00e1ch ch\u01b0a up \u1ea3nh", inline: false },
          { name: "Th\u1eddi gian", value: order.createdAt, inline: false }
        ],
        image: order.paymentProofUrl ? { url: order.paymentProofUrl } : undefined,
        timestamp: order.createdAt
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`Discord webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.warn(`Discord webhook error: ${error.message}`);
  }
}

ensureDataFiles();

app.get("/", (req, res) => {
  const services = getServices();
  renderWithLocals(res, "index", { services });
});

app.get("/service/:id", (req, res) => {
  const service = findService(req.params.id);
  if (!service) {
    return res.status(404).send("Service not found");
  }
  return renderWithLocals(res, "service", { service });
});

app.get("/order/:id", (req, res) => {
  const service = findService(req.params.id);
  if (!service) {
    return res.status(404).send("Service not found");
  }
  if (service.status !== "in_stock") {
    return renderWithLocals(res, "service", {
      service,
      error: "Dịch vụ này đang hết hàng, vui lòng chọn dịch vụ khác."
    });
  }
  return renderWithLocals(res, "order", { service, errors: [], values: {} });
});

function handleProofUpload(req, res, next) {
  proofUpload.single("paymentProofImage")(req, res, (error) => {
    if (!error) {
      return next();
    }

    const service = findService(req.params.id);
    if (!service) {
      return res.status(404).send("Service not found");
    }

    return renderWithLocals(res, "order", {
      service,
      errors: [error.message],
      values: {
        customerName: cleanInput(req.body.customerName, 120),
        discord: cleanInput(req.body.discord, 160),
        contact: cleanInput(req.body.contact, 160),
        note: cleanInput(req.body.note, 1000)
      }
    });
  });
}

app.post("/order/:id", handleProofUpload, async (req, res) => {
  const service = findService(req.params.id);
  if (!service) {
    return res.status(404).send("Service not found");
  }
  if (service.status !== "in_stock") {
    return renderWithLocals(res, "service", {
      service,
      error: "Dịch vụ này đang hết hàng, không thể đặt hàng."
    });
  }

  const values = {
    customerName: cleanInput(req.body.customerName, 120),
    discord: cleanInput(req.body.discord, 160),
    contact: cleanInput(req.body.contact, 160),
    note: cleanInput(req.body.note, 1000)
  };

  const errors = [];
  if (!values.customerName) errors.push("Vui lòng nhập tên khách hàng.");
  if (!values.discord) errors.push("Vui lòng nhập Discord username hoặc Discord ID.");
  if (!values.contact) errors.push("Vui lòng nhập phương thức liên hệ.");

  if (errors.length > 0) {
    return renderWithLocals(res, "order", { service, errors, values });
  }

  const order = {
    id: generateOrderId(),
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    customerName: values.customerName,
    discord: values.discord,
    contact: values.contact,
    note: values.note,
    paymentProofImage: req.file ? `/uploads/proofs/${req.file.filename}` : "",
    paymentProofUrl: req.file ? `${getBaseUrl(req)}/uploads/proofs/${req.file.filename}` : "",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  await sendDiscordWebhook(order);

  return res.redirect(`/success/${encodeURIComponent(order.id)}`);
});

app.get("/success/:orderId", (req, res) => {
  const order = getOrders().find((item) => item.id === req.params.orderId);
  if (!order) {
    return res.status(404).send("Order not found");
  }
  return renderWithLocals(res, "success", { order });
});

app.get("/admin/login", (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect("/admin");
  }
  return renderWithLocals(res, "admin-login", { error: "" });
});

app.post("/admin/login", (req, res) => {
  const admin = getAdmin();
  const username = cleanInput(req.body.username, 80);
  const password = cleanInput(req.body.password, 160);

  if (username === admin.username && password === admin.password) {
    req.session.isAdmin = true;
    req.session.adminUsername = username;
    return res.redirect("/admin");
  }

  return renderWithLocals(res, "admin-login", {
    error: "Sai tài khoản hoặc mật khẩu admin."
  });
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

app.get("/admin", requireAdmin, (req, res) => {
  const services = getServices();
  const orders = getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const newOrders = orders.filter((order) => order.status === "pending").slice(0, 5);

  renderWithLocals(res, "admin-dashboard", {
    services,
    orders,
    newOrders,
    adminUsername: req.session.adminUsername
  });
});

app.get("/admin/services", requireAdmin, (req, res) => {
  renderWithLocals(res, "admin-services", {
    services: getServices(),
    mode: "list",
    service: null,
    errors: [],
    values: {}
  });
});

app.get("/admin/services/new", requireAdmin, (req, res) => {
  renderWithLocals(res, "admin-services", {
    services: getServices(),
    mode: "new",
    service: null,
    errors: [],
    values: { name: "", price: "", description: "", status: "in_stock" }
  });
});

app.post("/admin/services/new", requireAdmin, (req, res) => {
  const services = getServices();
  const values = {
    name: cleanInput(req.body.name, 120),
    price: cleanInput(req.body.price, 80),
    description: cleanInput(req.body.description, 1000),
    status: SERVICE_STATUSES.includes(req.body.status) ? req.body.status : "in_stock"
  };

  const errors = validateService(values);
  if (errors.length > 0) {
    return renderWithLocals(res, "admin-services", {
      services,
      mode: "new",
      service: null,
      errors,
      values
    });
  }

  let id = makeSlug(values.name);
  if (services.some((item) => item.id === id)) {
    id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
  }

  services.push({ id, ...values });
  saveServices(services);
  return res.redirect("/admin/services");
});

app.get("/admin/services/edit/:id", requireAdmin, (req, res) => {
  const services = getServices();
  const service = services.find((item) => item.id === req.params.id);
  if (!service) {
    return res.status(404).send("Service not found");
  }
  return renderWithLocals(res, "admin-services", {
    services,
    mode: "edit",
    service,
    errors: [],
    values: service
  });
});

app.post("/admin/services/edit/:id", requireAdmin, (req, res) => {
  const services = getServices();
  const index = services.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).send("Service not found");
  }

  const values = {
    name: cleanInput(req.body.name, 120),
    price: cleanInput(req.body.price, 80),
    description: cleanInput(req.body.description, 1000),
    status: SERVICE_STATUSES.includes(req.body.status) ? req.body.status : "in_stock"
  };

  const errors = validateService(values);
  if (errors.length > 0) {
    return renderWithLocals(res, "admin-services", {
      services,
      mode: "edit",
      service: services[index],
      errors,
      values
    });
  }

  services[index] = { ...services[index], ...values };
  saveServices(services);
  return res.redirect("/admin/services");
});

app.post("/admin/services/delete/:id", requireAdmin, (req, res) => {
  const services = getServices().filter((service) => service.id !== req.params.id);
  saveServices(services);
  return res.redirect("/admin/services");
});

app.get("/admin/orders", requireAdmin, (req, res) => {
  const orders = getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderWithLocals(res, "admin-orders", { orders });
});

app.post("/admin/orders/status/:id", requireAdmin, (req, res) => {
  const nextStatus = cleanInput(req.body.status, 40);
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.redirect("/admin/orders");
  }

  const orders = getOrders();
  const order = orders.find((item) => item.id === req.params.id);
  if (order) {
    order.status = nextStatus;
    saveOrders(orders);
  }
  return res.redirect("/admin/orders");
});

function validateService(values) {
  const errors = [];
  if (!values.name) errors.push("Tên dịch vụ không được để trống.");
  if (!values.price) errors.push("Giá dịch vụ không được để trống.");
  if (!values.description) errors.push("Mô tả dịch vụ không được để trống.");
  return errors;
}

app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
