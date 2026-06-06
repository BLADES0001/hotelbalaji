const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
process.chdir(__dirname);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!String(storedPassword).startsWith("scrypt$")) {
    return String(password) === String(storedPassword);
  }

  const [, salt, storedHash] = storedPassword.split("$");
  const suppliedHash = crypto.scryptSync(String(password), salt, 64);
  const expectedHash = Buffer.from(storedHash, "hex");
  return suppliedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(suppliedHash, expectedHash);
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function readJsonFile(fileName, fallback) {
  if (!fs.existsSync(fileName)) return fallback;
  return JSON.parse(fs.readFileSync(fileName));
}

function writeJsonFile(fileName, value) {
  fs.writeFileSync(fileName, JSON.stringify(value, null, 2));
}

function publicCustomer(customer) {
  if (!customer) return null;
  const { password, ...safeCustomer } = customer;
  return safeCustomer;
}

function logActivity(type, message, details = {}) {
  activityLogs.push({
    id: Date.now(),
    type,
    message,
    details,
    createdAt: Date.now()
  });
  writeJsonFile("activityLogs.json", activityLogs.slice(-500));
}

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === "/sw.js" || req.path.startsWith("/menu/") ||
      req.path === "/restaurants" || req.path.startsWith("/customer-orders/") ||
      req.path.startsWith("/customer") || req.path.startsWith("/order-status/") ||
      req.path.startsWith("/admin") || req.path.startsWith("/restaurant-analytics/") ||
      req.path === "/coupons" || req.path === "/trending-foods" ||
      req.path.startsWith("/admin-advertisements") || req.path === "/active-advertisement" ||
      req.path.startsWith("/restaurant-advertisement") ||
      req.path === "/orders" || req.path === "/owner" ||
      req.path.startsWith("/delivery") || req.path.startsWith("/restaurant-delivery") ||
      req.path.startsWith("/recommendations/")) {
    res.set("Cache-Control", "no-store");
  }
  next();
});

// serve frontend
app.use(express.static(path.join(__dirname, "public")));
console.log("Serving from:");
console.log(path.join(__dirname, "public"));

// ================= MENU =================

let menu = [];

if (fs.existsSync("menu.json")) {

  const data = fs.readFileSync("menu.json");

  menu = JSON.parse(data);

}
console.log("MENU ITEMS:", menu.length);
console.log(menu);

// get menu
app.get("/menu/:username", (req, res) => {

  const username = req.params.username;

  const restaurantMenu = menu.filter(item =>
    item.restaurantUsername === username
  );

  res.json(restaurantMenu);

});

// delete item
app.post("/delete-item/:id", (req, res) => {

  const id = Number(req.params.id);

  menu = menu.filter(item => item.id !== id);

  fs.writeFileSync(
    "menu.json",
    JSON.stringify(menu, null, 2)
  );

  res.send("Deleted");

});

app.post("/edit-item/:id", (req, res) => {

const id = Number(req.params.id);

const item = menu.find(i => i.id === id);

if(item){

item.name = req.body.name;

item.price = Number(req.body.price);

item.category = req.body.category;

item.image = req.body.image;

fs.writeFileSync(
"menu.json",
JSON.stringify(menu, null, 2)
);

}

res.send("Updated");

});

// add item
app.post("/add-item", (req, res) => {

const newItem = {
  id: Date.now(),
  name: req.body.name,
  price: Number(req.body.price),
  category: req.body.category,
  image: req.body.image,
  gallery: req.body.gallery || [],
  description: req.body.description || "",
  rating: Number(req.body.rating || 0),
  foodType: req.body.foodType || "veg",
  bestseller: Boolean(req.body.bestseller),
  recommended: Boolean(req.body.recommended),
  popular: Boolean(req.body.popular),
  restaurantUsername: req.body.restaurantUsername
};

  menu.push(newItem);

  fs.writeFileSync(
    "menu.json",
    JSON.stringify(menu, null, 2)
  );

  res.send("Item added");

});

app.post("/toggle-restaurant/:username", (req, res) => {

const restaurant = restaurants.find(r =>
r.username === req.params.username
);

if(restaurant){

restaurant.isOpen = !restaurant.isOpen;

fs.writeFileSync(
"restaurants.json",
JSON.stringify(restaurants, null, 2)
);

}

res.send("Updated");

});

// ================= ORDERS =================

let orders = [];
let completedOrders = [];
let customers = readJsonFile("customers.json", []);
let deliveryMen = readJsonFile("deliveryMen.json", []);
let otpRequests = readJsonFile("otpRequests.json", []);
let activityLogs = readJsonFile("activityLogs.json", []);
let coupons = readJsonFile("coupons.json", [
  {
    code: "FOODZA10",
    type: "percent",
    value: 10,
    active: true
  }
]);
let advertisements = readJsonFile("advertisements.json", []);

// ================= RESTAURANTS =================

let restaurants = [];

if (fs.existsSync("restaurants.json")) {

  restaurants = JSON.parse(
    fs.readFileSync("restaurants.json")
  );

}

const hasPlainTextPasswords = restaurants.some(restaurant =>
  !String(restaurant.password).startsWith("scrypt$")
);

if (hasPlainTextPasswords) {
  restaurants.forEach(restaurant => {
    if (!String(restaurant.password).startsWith("scrypt$")) {
      restaurant.password = hashPassword(restaurant.password);
    }
  });
  fs.writeFileSync("restaurants.json", JSON.stringify(restaurants, null, 2));
}

// RESTAURANT LOGIN

app.post("/restaurant-login", (req, res) => {

  const restaurant = restaurants.find(r =>

    r.username === req.body.username &&
    verifyPassword(req.body.password, r.password)

  );

  if(!restaurant){

    return res.json({
      success:false,
      message:"Invalid username or password"
    });

  }

  if(!restaurant.approved){

    return res.json({
      success:false,
      message:
      "Subscription not approved yet. Please send payment screenshot to WhatsApp 9880520082"
    });

  }

  res.json({
    success:true,
    restaurant
  });

});

// REGISTER RESTAURANT

app.post("/register-restaurant", (req, res) => {
  const requiredFields = [
    "hotelName", "ownerName", "mobile", "address",
    "city", "pincode", "username", "password"
  ];

  if (requiredFields.some(field => !String(req.body[field] || "").trim())) {
    return res.status(400).send("Please complete all required fields.");
  }

  const existingRestaurant = restaurants.find(r =>

    r.hotelName.toLowerCase() === req.body.hotelName.toLowerCase() ||

    r.mobile === req.body.mobile ||

    r.username.toLowerCase() === req.body.username.toLowerCase()

  );

  if(existingRestaurant){

    return res.send(
      "Restaurant already registered. Please use different details."
    );

  }

  const restaurant = {

    id: Date.now(),

    hotelName: req.body.hotelName,

    ownerName: req.body.ownerName,

    mobile: req.body.mobile,

    address: req.body.address,

    city: req.body.city,

    pincode: req.body.pincode,

    username: req.body.username,

    password: hashPassword(req.body.password),

    deliveryRange:
      req.body.deliveryRange,

    deliveryType:
      req.body.deliveryType,

    deliveryCharge:
      req.body.deliveryCharge,

    logo:"/logo.png",

    rating:null,

    estimatedDeliveryTime:null,

    popular:false,

    subscriptionStatus:"pending",

    approved:false,

    isOpen:true,

    createdAt:Date.now()

  };

  restaurants.push(restaurant);

  fs.writeFileSync(
    "restaurants.json",
    JSON.stringify(
      restaurants,
      null,
      2
    )
  );

  console.log(
    "New Restaurant Registered:",
    restaurant
  );

  res.send(
    "Registration submitted successfully and waiting for owner approval."
  );

});

// GET ALL RESTAURANTS

app.get("/restaurants", (req, res) => {

  res.json(restaurants.map(({ password, ...restaurant }) => restaurant));

});


// APPROVE RESTAURANT

app.post("/approve-restaurant/:id", (req, res) => {

  const id = Number(req.params.id);

  const restaurant = restaurants.find(r =>
    r.id === id
  );

  if(restaurant){

    restaurant.approved = true;
    restaurant.suspended = false;
    restaurant.isOpen = true;

    restaurant.subscriptionStatus =
    "active";

    fs.writeFileSync(
      "restaurants.json",
      JSON.stringify(
        restaurants,
        null,
        2
      )
    );
    logActivity("restaurant_approved", `${restaurant.hotelName} approved`, {
      restaurantId:id
    });

  }

  res.json(restaurant || { message:"Restaurant not found" });

});

app.post("/owner-login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");
  if (username === "Pranav" && password === "Pranavd.g@123") {
    return res.json({ success:true });
  }
  res.status(401).json({
    success:false,
    message:"Invalid owner username or password"
  });
});

// LOAD SAVED ORDERS

if (fs.existsSync("orders.json")) {
  orders = JSON.parse(fs.readFileSync("orders.json"));
}

if (fs.existsSync("completedOrders.json")) {
  completedOrders = JSON.parse(
    fs.readFileSync("completedOrders.json")
  );
}

function removeLegacyDineIn(order) {
  if (order.orderType === "dinein") order.orderType = "pickup";
  if ("table" in order) order.table = null;
  if (order.done || order.completedAt) {
    order.status = "delivered";
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    if (!order.statusHistory.some(item => item.status === "delivered")) {
      order.statusHistory.push({
        status:"delivered",
        time:order.completedAt || Date.now()
      });
    }
  }
  return order;
}

orders = orders.map(removeLegacyDineIn);
completedOrders = completedOrders.map(removeLegacyDineIn);
writeJsonFile("orders.json", orders);
writeJsonFile("completedOrders.json", completedOrders);

// receive order
app.post("/order", (req, res) => {
const restaurant = restaurants.find(item =>
  item.username === req.body.restaurantUsername
);

if (!restaurant || !restaurant.approved || !restaurant.isOpen) {
  return res.status(400).json({
    message:"Restaurant is unavailable"
  });
}

if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
  return res.status(400).json({
    message:"Cart is empty"
  });
}

if (req.body.items.some(item =>
  item.restaurantUsername !== restaurant.username ||
  !Number.isFinite(Number(item.price)) ||
  !Number.isInteger(item.quantity) ||
  item.quantity < 1 ||
  !menu.some(menuItem =>
    menuItem.id === item.id &&
    menuItem.restaurantUsername === restaurant.username &&
    Number(menuItem.price) === Number(item.price)
  )
)) {
  return res.status(400).json({
    message:"Cart contains invalid items"
  });
}

if (!String(req.body.mobile || "").trim()) {
  return res.status(400).json({
    message:"Customer mobile number is required"
  });
}

const grandTotal = Number(req.body.pricing?.grandTotal || 0);

const order = {

  id: Date.now(),

  orderId:
    "FZ" + Date.now(),

  status:"received",

  statusHistory:[
    {
      status:"received",
      time:Date.now()
    }
  ],

  ...req.body,

  restaurantUsername:
    req.body.restaurantUsername,

  done:false,

  estimatedDeliveryTime:
    restaurant.estimatedDeliveryTime || 35,

  createdAt: Date.now()

};

  orders.push(order);

  fs.writeFileSync(
    "orders.json",
    JSON.stringify(orders, null, 2)
  );

  console.log("New Order:", order);
  logActivity("order_created", `Order ${order.orderId} placed`, {
    mobile:req.body.mobile,
    restaurantUsername:req.body.restaurantUsername,
    grandTotal
  });

  res.status(201).json(order);

});

// mark order done
app.post("/done/:id", (req, res) => {

const id = Number(req.params.id);

const index = orders.findIndex(
order => order.id === id
);

if(index === -1){
  return res.status(404).json({
    message:"Order not found"
  });
}

const completed = orders[index];

  completed.completedAt = Date.now();

  completed.done = true;
  completed.status = "delivered";
  completed.statusHistory = Array.isArray(completed.statusHistory) ? completed.statusHistory : [];
  completed.statusHistory.push({
    status:"delivered",
    time:completed.completedAt
  });

  completedOrders.push(completed);

  orders.splice(index, 1);

  fs.writeFileSync(
    "orders.json",
    JSON.stringify(orders, null, 2)
  );

  fs.writeFileSync(
    "completedOrders.json",
    JSON.stringify(completedOrders, null, 2)
  );

  res.json(completed);

});

// CUSTOMER ACTIVE ORDERS

app.get("/customer-orders/:mobile", (req, res) => {

  const mobile = req.params.mobile;

  const customerOrders = orders.filter(order =>

    order.mobile === mobile &&
    !order.done

  );

  res.json(customerOrders);

});

app.get("/order-status/:orderId", (req, res) => {
  const order = orders.find(item => item.orderId === req.params.orderId) ||
    completedOrders.find(item => item.orderId === req.params.orderId);

  if (!order) {
    return res.status(404).json({
      message:"Order not found"
    });
  }

  res.json(order);
});

app.post("/order-status/:orderId", (req, res) => {
  const order = orders.find(item => item.orderId === req.params.orderId);
  const allowedStatuses = ["received", "preparing", "packed", "out_for_delivery", "delivered"];

  if (!order) {
    return res.status(404).json({
      message:"Order not found"
    });
  }

  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({
      message:"Invalid order status"
    });
  }

  order.status = req.body.status;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status:req.body.status,
    time:Date.now()
  });

  if (req.body.status === "delivered") {
    order.done = true;
    order.completedAt = Date.now();
    completedOrders.push(order);
    orders = orders.filter(item => item.orderId !== order.orderId);
    writeJsonFile("completedOrders.json", completedOrders);
  }

  writeJsonFile("orders.json", orders);
  logActivity("order_status", `Order ${order.orderId} moved to ${req.body.status}`, {
    orderId: order.orderId,
    status: req.body.status
  });
  res.json(order);
});

// ================= CUSTOMER ACCOUNTS =================

app.post("/customer-signup", (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").trim();
  const password = String(req.body.password || "").trim();

  if (!name || mobile.length < 10 || password.length < 4) {
    return res.status(400).json({
      message:"Name, valid mobile, and password are required"
    });
  }

  if (customers.some(customer => customer.mobile === mobile)) {
    return res.status(400).json({
      message:"Customer already exists"
    });
  }

  const customer = {
    id: Date.now(),
    name,
    mobile,
    password: hashPassword(password),
    referralCode: "FZ" + mobile.slice(-4) + Math.floor(Math.random() * 900 + 100),
    addresses: [],
    favouriteRestaurants: [],
    favouriteFoods: [],
    createdAt: Date.now()
  };

  customers.push(customer);
  writeJsonFile("customers.json", customers);
  logActivity("customer_signup", `${name} signed up`, { mobile });
  res.status(201).json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.post("/customer-password-auth", (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").replace(/\D/g, "");
  const password = String(req.body.password || "").trim();
  let customer = customers.find(item => item.mobile === mobile);

  if (mobile.length < 10 || password.length < 4) {
    return res.status(400).json({
      success:false,
      message:"Valid mobile and 4+ character password are required"
    });
  }

  if (!customer) {
    customer = {
      id: Date.now(),
      name: name || "Foodza Customer",
      mobile,
      password: hashPassword(password),
      referralCode: "FZ" + mobile.slice(-4) + Math.floor(Math.random() * 900 + 100),
      addresses: [],
      favouriteRestaurants: [],
      favouriteFoods: [],
      createdAt: Date.now()
    };
    customers.push(customer);
    writeJsonFile("customers.json", customers);
    logActivity("customer_signup_password", `${customer.name} created password login`, { mobile });
    return res.status(201).json({
      success:true,
      customer: publicCustomer(customer)
    });
  }

  if (!customer.password) {
    customer.name = name || customer.name;
    customer.password = hashPassword(password);
    writeJsonFile("customers.json", customers);
    logActivity("customer_password_set", `${customer.name} set password`, { mobile });
    return res.json({
      success:true,
      customer: publicCustomer(customer)
    });
  }

  if (!verifyPassword(password, customer.password)) {
    return res.status(401).json({
      success:false,
      message:"Invalid mobile or password"
    });
  }

  res.json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.post("/customer-login", (req, res) => {
  const mobile = String(req.body.mobile || "").trim();
  const customer = customers.find(item => item.mobile === mobile);

  if (!customer || !verifyPassword(req.body.password, customer.password)) {
    return res.status(401).json({
      success:false,
      message:"Invalid mobile or password"
    });
  }

  res.json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.post("/customer-otp/request", (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "");

  if (mobile.length < 10) {
    return res.status(400).json({
      success:false,
      message:"Enter a valid mobile number"
    });
  }

  const otp = generateOtp();
  otpRequests = otpRequests.filter(request =>
    request.mobile !== mobile && request.expiresAt > Date.now()
  );
  otpRequests.push({
    id: Date.now(),
    mobile,
    otpHash: hashOtp(otp),
    attempts: 0,
    expiresAt: Date.now() + 5 * 60 * 1000,
    createdAt: Date.now()
  });
  writeJsonFile("otpRequests.json", otpRequests);
  logActivity("customer_otp_requested", `OTP requested for ${mobile}`, { mobile });

  console.log(`Foodza OTP for ${mobile}: ${otp}`);
  res.json({
    success:true,
    message:"OTP sent successfully",
    // Development-only. Replace this with a real SMS provider response in production.
    devOtp: otp
  });
});

app.post("/customer-otp/verify", (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").replace(/\D/g, "");
  const otp = String(req.body.otp || "").trim();
  const request = otpRequests
    .filter(item => item.mobile === mobile)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!request || request.expiresAt < Date.now()) {
    return res.status(400).json({
      success:false,
      message:"OTP expired. Please request a new OTP."
    });
  }

  if (request.attempts >= 5) {
    return res.status(429).json({
      success:false,
      message:"Too many OTP attempts. Please request a new OTP."
    });
  }

  if (request.otpHash !== hashOtp(otp)) {
    request.attempts += 1;
    writeJsonFile("otpRequests.json", otpRequests);
    return res.status(401).json({
      success:false,
      message:"Invalid OTP"
    });
  }

  let customer = customers.find(item => item.mobile === mobile);
  if (!customer) {
    customer = {
      id: Date.now(),
      name: name || "Foodza Customer",
      mobile,
      password: "",
      referralCode: "FZ" + mobile.slice(-4) + Math.floor(Math.random() * 900 + 100),
      addresses: [],
      favouriteRestaurants: [],
      favouriteFoods: [],
      createdAt: Date.now()
    };
    customers.push(customer);
    logActivity("customer_signup_otp", `${customer.name} signed up with OTP`, { mobile });
  } else if (name) {
    customer.name = name;
  }

  otpRequests = otpRequests.filter(item => item.mobile !== mobile);
  writeJsonFile("customers.json", customers);
  writeJsonFile("otpRequests.json", otpRequests);
  logActivity("customer_login_otp", `${customer.name} logged in with OTP`, { mobile });

  res.json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.post("/customer-password-reset", (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "");
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "").trim();
  const customer = customers.find(item => item.mobile === mobile);
  const request = otpRequests
    .filter(item => item.mobile === mobile)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!customer) return res.status(404).json({ success:false, message:"Customer not found" });
  if (password.length < 4) return res.status(400).json({ success:false, message:"New password must be at least 4 characters" });
  if (!request || request.expiresAt < Date.now()) {
    return res.status(400).json({ success:false, message:"OTP expired. Please request a new OTP." });
  }
  if (request.otpHash !== hashOtp(otp)) {
    request.attempts += 1;
    writeJsonFile("otpRequests.json", otpRequests);
    return res.status(401).json({ success:false, message:"Invalid OTP" });
  }

  customer.password = hashPassword(password);
  otpRequests = otpRequests.filter(item => item.mobile !== mobile);
  writeJsonFile("customers.json", customers);
  writeJsonFile("otpRequests.json", otpRequests);
  logActivity("customer_password_reset", `${customer.name} reset password using OTP`, { mobile });
  res.json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.post("/customer-guest", (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").trim();

  if (!name || mobile.length < 10) {
    return res.status(400).json({
      message:"Name and valid mobile are required"
    });
  }

  let customer = customers.find(item => item.mobile === mobile);
  if (!customer) {
    customer = {
      id: Date.now(),
      name,
      mobile,
      password: "",
      referralCode: "FZ" + mobile.slice(-4) + Math.floor(Math.random() * 900 + 100),
      addresses: [],
      favouriteRestaurants: [],
      favouriteFoods: [],
      createdAt: Date.now()
    };
    customers.push(customer);
  } else {
    customer.name = name;
  }

  writeJsonFile("customers.json", customers);
  res.json({
    success:true,
    customer: publicCustomer(customer)
  });
});

app.get("/customer/:mobile", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer) {
    return res.status(404).json({
      message:"Customer not found"
    });
  }
  res.json(publicCustomer(customer));
});

app.post("/customer/:mobile/profile", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer) {
    return res.status(404).json({
      message:"Customer not found"
    });
  }

  customer.name = String(req.body.name || customer.name).trim();
  customer.mobile = String(req.body.mobile || customer.mobile).trim();
  writeJsonFile("customers.json", customers);
  res.json(publicCustomer(customer));
});

app.post("/customer/:mobile/password", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer || (customer.password && !verifyPassword(req.body.oldPassword, customer.password))) {
    return res.status(400).json({
      message:"Current password is incorrect"
    });
  }

  customer.password = hashPassword(req.body.newPassword);
  writeJsonFile("customers.json", customers);
  res.json({
    success:true
  });
});

app.post("/customer/:mobile/addresses", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer) {
    return res.status(404).json({
      message:"Customer not found"
    });
  }

  const address = {
    id: Date.now(),
    label: req.body.label || "Home",
    line1: req.body.line1 || "",
    landmark: req.body.landmark || "",
    city: req.body.city || "",
    pincode: req.body.pincode || "",
    instructions: req.body.instructions || ""
  };

  customer.addresses.push(address);
  writeJsonFile("customers.json", customers);
  res.status(201).json(address);
});

app.post("/customer/:mobile/favourite-restaurant/:username", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer) return res.status(404).json({ message:"Customer not found" });

  const username = req.params.username;
  if (customer.favouriteRestaurants.includes(username)) {
    customer.favouriteRestaurants = customer.favouriteRestaurants.filter(item => item !== username);
  } else {
    customer.favouriteRestaurants.push(username);
  }
  writeJsonFile("customers.json", customers);
  res.json(publicCustomer(customer));
});

app.post("/customer/:mobile/favourite-food/:id", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  if (!customer) return res.status(404).json({ message:"Customer not found" });

  const id = Number(req.params.id);
  if (customer.favouriteFoods.includes(id)) {
    customer.favouriteFoods = customer.favouriteFoods.filter(item => item !== id);
  } else {
    customer.favouriteFoods.push(id);
  }
  writeJsonFile("customers.json", customers);
  res.json(publicCustomer(customer));
});

app.get("/customer-history/:mobile", (req, res) => {
  const mobile = req.params.mobile;
  res.json([
    ...orders.filter(order => order.mobile === mobile),
    ...completedOrders.filter(order => order.mobile === mobile)
  ].sort((a, b) => b.createdAt - a.createdAt));
});

app.get("/coupons", (req, res) => {
  res.json(coupons.filter(coupon => coupon.active));
});

app.get("/trending-foods", (req, res) => {
  const sales = {};
  allOrders().forEach(order => {
    (order.items || []).forEach(item => {
      const id = Number(item.id);
      if (!sales[id]) {
        sales[id] = {
          id,
          name:item.name,
          category:item.category,
          price:Number(item.price || 0),
          restaurantUsername:item.restaurantUsername || order.restaurantUsername,
          quantity:0,
          revenue:0
        };
      }
      sales[id].quantity += Number(item.quantity || 0);
      sales[id].revenue += Number(item.price || 0) * Number(item.quantity || 0);
    });
  });

  const soldFoods = Object.values(sales).sort((a, b) => b.quantity - a.quantity);
  const fallbackFoods = menu
    .filter(item => item.popular || item.bestseller || item.recommended)
    .map(item => ({
      ...item,
      quantity:0,
      revenue:0
    }));

  res.json((soldFoods.length ? soldFoods : fallbackFoods).slice(0, 12));
});

app.post("/customer/:mobile/referral/apply", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  const code = String(req.body.code || "").trim().toUpperCase();
  const referrer = customers.find(item =>
    String(item.referralCode || "").toUpperCase() === code &&
    item.mobile !== req.params.mobile
  );

  if (!customer) return res.status(404).json({ message:"Customer not found" });
  if (!referrer) return res.status(400).json({ message:"Invalid referral code" });
  if (customer.referredBy) return res.status(400).json({ message:"Referral already applied" });

  customer.referredBy = referrer.referralCode;
  writeJsonFile("customers.json", customers);
  logActivity("referral_applied", `${customer.name} used referral ${code}`, {
    customer:customer.mobile,
    referrer:referrer.mobile
  });
  res.json(publicCustomer(customer));
});

// ================= ANALYTICS / MANAGEMENT APIS =================

function allOrders() {
  return [...orders, ...completedOrders];
}

function orderTotal(order) {
  if (order.pricing && Number.isFinite(Number(order.pricing.grandTotal))) {
    return Number(order.pricing.grandTotal);
  }
  return (order.items || []).reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function analyticsForRestaurant(username) {
  const restaurantOrders = allOrders().filter(order => order.restaurantUsername === username);
  const activeRestaurantOrders = orders.filter(order => order.restaurantUsername === username);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const dailyOrders = restaurantOrders.filter(order => order.createdAt >= startOfDay(now));
  const weeklyOrders = restaurantOrders.filter(order => order.createdAt >= now - 7 * day);
  const monthlyOrders = restaurantOrders.filter(order => order.createdAt >= now - 30 * day);
  const foodSales = {};

  restaurantOrders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!foodSales[item.name]) {
        foodSales[item.name] = {
          name:item.name,
          quantity:0,
          revenue:0
        };
      }
      foodSales[item.name].quantity += Number(item.quantity);
      foodSales[item.name].revenue += Number(item.price) * Number(item.quantity);
    });
  });

  return {
    totalOrders: restaurantOrders.length,
    totalRevenue: restaurantOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    dailySales: dailyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    weeklySales: weeklyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    monthlySales: monthlyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    pendingOrders: activeRestaurantOrders.filter(order => order.status === "received").length,
    acceptedOrders: activeRestaurantOrders.filter(order => ["preparing", "packed", "out_for_delivery"].includes(order.status)).length,
    completedOrders: restaurantOrders.filter(order => order.done || order.status === "delivered").length,
    topSellingFoods: Object.values(foodSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    revenueChart: Array.from({ length: 7 }).map((_, index) => {
      const dayStart = startOfDay(now - (6 - index) * day);
      const dayEnd = dayStart + day;
      return {
        date: new Date(dayStart).toLocaleDateString(),
        revenue: restaurantOrders
          .filter(order => order.createdAt >= dayStart && order.createdAt < dayEnd)
          .reduce((sum, order) => sum + orderTotal(order), 0)
      };
    })
  };
}

app.get("/restaurant-analytics/:username", (req, res) => {
  res.json(analyticsForRestaurant(req.params.username));
});

app.get("/restaurant-dashboard-data/:username", (req, res) => {
  const username = req.params.username;
  const today = startOfDay(Date.now());
  const restaurantDeliveryMen = deliveryMen
    .filter(person => person.restaurantUsername === username)
    .map(({ password, ...person }) => {
      const deliveredToday = completedOrders.filter(order =>
        order.deliveryManUsername === person.username &&
        Number(order.completedAt || 0) >= today
      );
      return {
        ...person,
        deliveredTodayCount: deliveredToday.length,
        deliveredTodayTotal: deliveredToday.reduce((sum, order) => sum + orderTotal(order), 0)
      };
    });
  res.json({
    analytics: analyticsForRestaurant(username),
    pendingOrders: orders.filter(order => order.restaurantUsername === username && order.status === "received"),
    acceptedOrders: orders.filter(order => order.restaurantUsername === username && ["preparing", "packed", "out_for_delivery"].includes(order.status)),
    completedOrders: completedOrders.filter(order => order.restaurantUsername === username),
    deliveryMen: restaurantDeliveryMen,
    advertisements: advertisements.filter(ad => ad.restaurantUsername === username)
  });
});

app.post("/restaurant-advertisement/:username", (req, res) => {
  const restaurant = restaurants.find(item => item.username === req.params.username);
  if (!restaurant) return res.status(404).json({ message:"Restaurant not found" });

  const title = String(req.body.title || "").trim();
  const message = String(req.body.message || "").trim();
  const image = String(req.body.image || "").trim();
  if (!title || !message) {
    return res.status(400).json({ message:"Advertisement title and message are required" });
  }

  const ad = {
    id: Date.now(),
    restaurantUsername: restaurant.username,
    restaurantName: restaurant.hotelName,
    title,
    message,
    image,
    status: "pending",
    createdAt: Date.now()
  };
  advertisements.push(ad);
  writeJsonFile("advertisements.json", advertisements);
  logActivity("advertisement_applied", `${restaurant.hotelName} applied for advertisement`, {
    advertisementId: ad.id
  });
  res.status(201).json(ad);
});

app.get("/admin-advertisements", (req, res) => {
  res.json(advertisements.slice().sort((a, b) => b.createdAt - a.createdAt));
});

app.post("/admin-advertisements/:id/:action", (req, res) => {
  const ad = advertisements.find(item => item.id === Number(req.params.id));
  if (!ad) return res.status(404).json({ message:"Advertisement not found" });
  if (!["approve", "reject"].includes(req.params.action)) {
    return res.status(400).json({ message:"Invalid action" });
  }
  ad.status = req.params.action === "approve" ? "approved" : "rejected";
  ad.reviewedAt = Date.now();
  writeJsonFile("advertisements.json", advertisements);
  logActivity("advertisement_reviewed", `${ad.title} ${ad.status}`, {
    advertisementId: ad.id
  });
  res.json(ad);
});

app.get("/active-advertisement", (req, res) => {
  const active = advertisements
    .filter(ad => ad.status === "approved")
    .sort((a, b) => b.reviewedAt - a.reviewedAt)[0] || null;
  res.json(active);
});

app.get("/restaurant-delivery/:username", (req, res) => {
  res.json(deliveryMen
    .filter(person => person.restaurantUsername === req.params.username)
    .map(({ password, ...person }) => person));
});

app.post("/restaurant-delivery/:username", (req, res) => {
  const restaurant = restaurants.find(item => item.username === req.params.username);
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").trim();
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "").trim();

  if (!restaurant) return res.status(404).json({ message:"Restaurant not found" });
  if (!name || !mobile || !username || password.length < 4) {
    return res.status(400).json({ message:"Name, mobile, unique username, and 4+ character password are required" });
  }
  if (deliveryMen.some(person => person.username === username)) {
    return res.status(400).json({ message:"Delivery username already exists" });
  }

  const person = {
    id: Date.now(),
    name,
    mobile,
    username,
    password: hashPassword(password),
    restaurantUsername: restaurant.username,
    restaurantName: restaurant.hotelName,
    active: true,
    createdAt: Date.now()
  };

  deliveryMen.push(person);
  writeJsonFile("deliveryMen.json", deliveryMen);
  logActivity("delivery_created", `${name} added as delivery staff`, {
    restaurantUsername: restaurant.username,
    username
  });
  const { password: _password, ...safePerson } = person;
  res.status(201).json(safePerson);
});

app.post("/restaurant-delivery/:username/:id/toggle", (req, res) => {
  const person = deliveryMen.find(item =>
    item.restaurantUsername === req.params.username &&
    item.id === Number(req.params.id)
  );
  if (!person) return res.status(404).json({ message:"Delivery staff not found" });
  person.active = !person.active;
  writeJsonFile("deliveryMen.json", deliveryMen);
  logActivity("delivery_toggled", `${person.name} active status changed`, {
    username:person.username,
    active:person.active
  });
  const { password, ...safePerson } = person;
  res.json(safePerson);
});

app.post("/assign-delivery/:orderId", (req, res) => {
  const order = orders.find(item => item.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ message:"Order not found" });

  const person = deliveryMen.find(item =>
    item.id === Number(req.body.deliveryManId) &&
    item.restaurantUsername === order.restaurantUsername &&
    item.active
  );
  if (!person) return res.status(400).json({ message:"Active delivery staff not found for this restaurant" });

  order.deliveryManId = person.id;
  order.deliveryManUsername = person.username;
  order.deliveryManName = person.name;
  order.status = order.status === "received" ? "preparing" : order.status;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({
    status:"delivery_assigned",
    time:Date.now(),
    deliveryManUsername:person.username
  });
  writeJsonFile("orders.json", orders);
  logActivity("delivery_assigned", `${person.name} assigned to ${order.orderId}`, {
    orderId:order.orderId,
    deliveryManUsername:person.username
  });
  res.json(order);
});

app.post("/delivery-login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const person = deliveryMen.find(item => item.username === username);
  if (!person || !person.active || !verifyPassword(req.body.password, person.password)) {
    return res.status(401).json({
      success:false,
      message:"Invalid delivery username or password"
    });
  }
  const { password, ...safePerson } = person;
  res.json({
    success:true,
    deliveryMan:safePerson
  });
});

app.get("/delivery-orders/:username", (req, res) => {
  const person = deliveryMen.find(item => item.username === req.params.username);
  if (!person) return res.status(404).json({ message:"Delivery staff not found" });
  res.json(orders.filter(order =>
    order.deliveryManUsername === person.username ||
    (
      !order.deliveryManUsername &&
      order.restaurantUsername === person.restaurantUsername &&
      ["packed", "out_for_delivery"].includes(order.status)
    )
  ));
});

app.get("/delivery-summary/:username", (req, res) => {
  const person = deliveryMen.find(item => item.username === req.params.username);
  if (!person) return res.status(404).json({ message:"Delivery staff not found" });
  const today = startOfDay(Date.now());
  const deliveredToday = completedOrders.filter(order =>
    order.deliveryManUsername === person.username &&
    Number(order.completedAt || 0) >= today
  );
  res.json({
    deliveryMan: {
      id: person.id,
      name: person.name,
      username: person.username,
      restaurantUsername: person.restaurantUsername
    },
    deliveredToday,
    deliveredTodayCount: deliveredToday.length,
    deliveredTodayTotal: deliveredToday.reduce((sum, order) => sum + orderTotal(order), 0)
  });
});

app.get("/admin-stats", (req, res) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const all = allOrders();
  const dailyOrders = all.filter(order => order.createdAt >= startOfDay(now));
  const weeklyOrders = all.filter(order => order.createdAt >= now - 7 * day);
  const monthlyOrders = all.filter(order => order.createdAt >= now - 30 * day);

  res.json({
    restaurants: restaurants.length,
    approvedRestaurants: restaurants.filter(restaurant => restaurant.approved).length,
    suspendedRestaurants: restaurants.filter(restaurant => restaurant.suspended).length,
    users: customers.length,
    deliveryMen: deliveryMen.length,
    activeOrders: orders.length,
    completedOrders: completedOrders.length,
    revenue: all.reduce((sum, order) => sum + orderTotal(order), 0),
    dailyRevenue: dailyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    weeklyRevenue: weeklyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    monthlyRevenue: monthlyOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    activityLogs: activityLogs.slice(-20).reverse()
  });
});

app.get("/admin-revenue-report", (req, res) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const all = allOrders();
  const byRestaurant = restaurants.map(restaurant => {
    const restaurantOrders = all.filter(order => order.restaurantUsername === restaurant.username);
    return {
      username:restaurant.username,
      hotelName:restaurant.hotelName,
      orders:restaurantOrders.length,
      revenue:restaurantOrders.reduce((sum, order) => sum + orderTotal(order), 0)
    };
  }).sort((a, b) => b.revenue - a.revenue);

  res.json({
    daily: all
      .filter(order => order.createdAt >= startOfDay(now))
      .reduce((sum, order) => sum + orderTotal(order), 0),
    weekly: all
      .filter(order => order.createdAt >= now - 7 * day)
      .reduce((sum, order) => sum + orderTotal(order), 0),
    monthly: all
      .filter(order => order.createdAt >= now - 30 * day)
      .reduce((sum, order) => sum + orderTotal(order), 0),
    total: all.reduce((sum, order) => sum + orderTotal(order), 0),
    byRestaurant
  });
});

app.get("/admin-orders", (req, res) => {
  res.json(allOrders().sort((a, b) => b.createdAt - a.createdAt));
});

app.get("/admin-users", (req, res) => {
  res.json(customers.map(publicCustomer));
});

app.get("/admin-delivery", (req, res) => {
  res.json(deliveryMen.map(({ password, ...person }) => person));
});

app.post("/reject-restaurant/:id", (req, res) => {
  const restaurant = restaurants.find(item => item.id === Number(req.params.id));
  if (!restaurant) return res.status(404).json({ message:"Restaurant not found" });
  restaurant.approved = false;
  restaurant.subscriptionStatus = "rejected";
  writeJsonFile("restaurants.json", restaurants);
  logActivity("restaurant_rejected", `${restaurant.hotelName} rejected`);
  res.json(restaurant);
});

app.post("/suspend-restaurant/:id", (req, res) => {
  const restaurant = restaurants.find(item => item.id === Number(req.params.id));
  if (!restaurant) return res.status(404).json({ message:"Restaurant not found" });
  restaurant.suspended = !restaurant.suspended;
  restaurant.isOpen = !restaurant.suspended;
  writeJsonFile("restaurants.json", restaurants);
  logActivity("restaurant_suspended", `${restaurant.hotelName} suspension toggled`, {
    suspended: restaurant.suspended
  });
  res.json(restaurant);
});

app.get("/admin-search", (req, res) => {
  const query = String(req.query.q || "").toLowerCase();
  res.json({
    restaurants: restaurants
      .filter(restaurant => `${restaurant.hotelName} ${restaurant.city} ${restaurant.username}`.toLowerCase().includes(query))
      .map(({ password, ...restaurant }) => restaurant),
    users: customers
      .map(publicCustomer)
      .filter(customer => `${customer.name} ${customer.mobile}`.toLowerCase().includes(query)),
    deliveryMen: deliveryMen
      .map(({ password, ...person }) => person)
      .filter(person => `${person.name} ${person.mobile} ${person.username} ${person.restaurantUsername}`.toLowerCase().includes(query)),
    orders: allOrders()
      .filter(order => `${order.orderId} ${order.name} ${order.mobile}`.toLowerCase().includes(query))
  });
});

app.get("/activity-logs", (req, res) => {
  res.json(activityLogs.slice().reverse());
});

app.get("/recommendations/:mobile", (req, res) => {
  const customer = customers.find(item => item.mobile === req.params.mobile);
  const favouriteCategories = new Set();
  allOrders()
    .filter(order => order.mobile === req.params.mobile)
    .forEach(order => (order.items || []).forEach(item => favouriteCategories.add(item.category)));

  const recommendedFoods = menu
    .filter(item => item.recommended || item.popular || favouriteCategories.has(item.category))
    .slice(0, 12);

  res.json({
    restaurants: restaurants
      .filter(restaurant => restaurant.approved && restaurant.isOpen)
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 6)
      .map(({ password, ...restaurant }) => restaurant),
    foods: recommendedFoods,
    favouriteRestaurants: customer?.favouriteRestaurants || [],
    favouriteFoods: customer?.favouriteFoods || []
  });
});

// ================= ADMIN PANEL =================

app.get("/admin", (req, res) => {

  let html = `
  <div id="loginPage">

<h2 style="
text-align:center;
margin-bottom:20px;
">
Restaurant Login
</h2>

<input
id="loginUsername"
placeholder="Username"
style="
width:100%;
padding:12px;
margin-bottom:10px;
"
>

<input
id="loginPassword"
type="password"
placeholder="Password"
style="
width:100%;
padding:12px;
margin-bottom:10px;
"
>

<button
onclick="login()"
style="
padding:12px;
width:100%;
background:#d4a017;
color:white;
border:none;
border-radius:8px;
font-size:16px;
"
>
Login
</button>

</div>

<div id="adminPanel" style="display:none;">
    <div style="
display:flex;
justify-content:space-between;
align-items:center;
">

<h1 id="hotelName">
Hotel
</h1>

<button onclick="toggleProfile()">
👤 Profile
</button>
<button onclick="toggleRestaurant()">
🟢 Open / Close
</button>

</div>

<div
id="profileBox"
style="
display:none;
border:1px solid #ccc;
padding:15px;
margin-bottom:20px;
border-radius:10px;
background:white;
"
>

<h3 id="profileHotel"></h3>

<p>
<b>UPI:</b>
hotelbalaji@upi
</p>

<p>
<b>WhatsApp:</b>
9880520082
</p>

<p>
<b>Subscription:</b>
<p>
<b>Status:</b>
<span id="openStatus"></span>
</p>
<span style="color:green;">
ACTIVE
</span>
</p>

<p>
<b>Delivery Range:</b>
<span id="deliveryRange"></span>
km
</p>

<p>
<b>Delivery Charge:</b>
₹<span id="deliveryCharge"></span>
</p>

<button onclick="logout()">
Logout
</button>

</div>

    <input id="search" placeholder="Search food">
    <br><br>

    Name:
    <input id="name">

    Price:
<input id="price">

Image URL:
<input id="image">

Category:
<input id="category">

    <button onclick="addItem()">Add Item</button>

    <hr>

    <div id="menu"></div>
    </div>
    <script>
    let restaurant = null;

async function login(){

const username =
document.getElementById(
'loginUsername'
).value;

const password =
document.getElementById(
'loginPassword'
).value;

const res = await fetch(
'/restaurant-login',
{
method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({
username,
password
})

});

const data = await res.json();

if(!data.success){

alert(data.message);
return;

}

restaurant = data.restaurant;

localStorage.setItem(
'restaurant',
JSON.stringify(restaurant)
);

document.getElementById(
'loginPage'
).style.display = 'none';

document.getElementById(
'adminPanel'
).style.display = 'block';

startAdmin();

}

let foods = [];

function startAdmin(){

document.getElementById(
'hotelName'
).innerText =
restaurant.hotelName;

document.getElementById(
'profileHotel'
).innerText =
restaurant.hotelName;

document.getElementById(
'deliveryRange'
).innerText =
restaurant.deliveryRange;

document.getElementById(
'deliveryCharge'
).innerText =
restaurant.deliveryCharge;

document.getElementById(
'openStatus'
).innerText =

restaurant.isOpen
? "OPEN"
: "CLOSED";

loadMenu();

}

function toggleProfile(){

const box =
document.getElementById(
'profileBox'
);

if(box.style.display === 'none'){

box.style.display = 'block';

}else{

box.style.display = 'none';

}

}

function toggleRestaurant(){

fetch(
'/toggle-restaurant/' +
restaurant.username,
{
method:'POST'
})
.then(() => {

alert(
'Restaurant status updated'
);

location.reload();

});

}

function logout(){

localStorage.removeItem(
'restaurant'
);

location.reload();

}

function loadMenu() {

fetch('/menu/' + restaurant.username)

.then(res => res.json())

.then(data => {

foods = data;

showFoods(data);

});

}

function showFoods(items) {

let html = "";

items.forEach(item => {

html +=
'<div style="margin-bottom:10px;border:1px solid black;padding:10px;border-radius:10px;">' +

'<img src="' + item.image + '" style="width:120px;height:120px;border-radius:10px;"><br><br>' +

'<b>' + item.name + '</b><br>' +

'<small>' + item.category + '</small><br>' +

'₹' + item.price + '<br>' +

'ID: ' + item.id + '<br><br>' +

'<button onclick="editItem(' + item.id + ')">Edit</button> ' +

'<button onclick="deleteItem(' + item.id + ')">Delete</button>' +

'</div>';

});

document.getElementById("menu").innerHTML = html;

}

function addItem() {

fetch('/add-item', {

method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({

name:
document.getElementById('name').value,

price:
document.getElementById('price').value,

image:
document.getElementById('image').value,

category:
document.getElementById('category').value,

restaurantUsername:
restaurant.username

})

})
.then(() => {

document.getElementById('name').value = "";
document.getElementById('price').value = "";
document.getElementById('image').value = "";
document.getElementById('category').value = "";

loadMenu();

});

}

function deleteItem(id) {

fetch('/delete-item/' + id, {
method:'POST'
})
.then(() => {

loadMenu();

});

}

function editItem(id){

const item = foods.find(f => f.id === id);

const newName =
prompt("New name", item.name);

const newPrice =
prompt("New price", item.price);

const newCategory =
prompt("New category", item.category);

const newImage =
prompt("New image URL", item.image);

fetch('/edit-item/' + id, {

method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({

name:newName,

price:newPrice,

category:newCategory,

image:newImage

})

})
.then(() => {

loadMenu();

});

}

      document.getElementById('search')
        .addEventListener('input', function() {

          const text = this.value.toLowerCase();

          const filtered = foods.filter(food =>
            food.name.toLowerCase().includes(text)
          );

          showFoods(filtered);

      });

      const savedRestaurant =
localStorage.getItem(
'restaurant'
);

if(savedRestaurant){

restaurant =
JSON.parse(savedRestaurant);

document.getElementById(
'loginPage'
).style.display = 'none';

document.getElementById(
'adminPanel'
).style.display = 'block';

startAdmin();

}

    </script>
  `;

  res.send(html);

});

// ================= UPGRADED ORDERS PAGE =================

app.get("/orders", (req, res, next) => {
  if (req.query.legacy === "1") return next();
  res.sendFile(path.join(__dirname, "public", "orders.html"));
});

// ================= ORDERS PAGE =================

app.get("/orders", (req, res) => {

let html = `
<html>

<head>

<title>Orders</title>

<style>

body{
  font-family:Arial;
  background:#f2f2f2;
  margin:0;
  padding:20px;
}

.container{
  display:flex;
  gap:20px;
}

.column{
  flex:1;
}

h1{
  text-align:center;
}

.order{
  background:white;
  padding:15px;
  margin-bottom:15px;
  border-radius:10px;
  box-shadow:0 0 10px rgba(0,0,0,0.1);
}

.done{
  background:green;
  color:white;
  border:none;
  padding:10px 15px;
  border-radius:5px;
  cursor:pointer;
}

.completed{
  border-left:8px solid green;
}

.tick{
  color:green;
  font-size:25px;
  font-weight:bold;
}

</style>

</head>

<body>
<div id="loginPage">

<h2>Restaurant Login</h2>

<input
id="loginUsername"
placeholder="Username"
>

<input
id="loginPassword"
type="password"
placeholder="Password"
>

<button onclick="login()">
Login
</button>

</div>

<div id="ordersPage" style="display:none;">
<div style="
display:flex;
justify-content:space-between;
align-items:center;
">

<h1 id="hotelTitle">
Orders
</h1>

<button onclick="logout()">
Logout
</button>

</div>

<div class="container">

<div class="column">

<h2>🟠 Current Orders</h2>
`;

orders.forEach((order, index) => {

let total = 0;

let itemsHTML = order.items.map(item => {

total += item.price * item.quantity;

return `
<div>
${item.name} x${item.quantity}<br>
<small>${item.custom || ""}</small><br>
₹${item.price * item.quantity}
</div><br>
`;

}).join("");

html += `

<div
class="order"
data-restaurant="${order.restaurantUsername}"
>

<b>Name:</b> ${order.name || "No Name"}<br>

<b>Mobile:</b> ${order.mobile || "No Mobile"}<br>

<b>Order Type:</b> ${order.orderType || "pickup"}<br>

${order.location
? `
<a href="${order.location.mapsLink}" target="_blank">
📍 Open Location
</a><br>
`
: ""}

<b>Time:</b> ${order.time}<br><br>

${itemsHTML}

<h3>Total: ₹${total}</h3>

<button
class="done"
onclick="markDone(${order.id})">
Done
</button>

</div>
`;

});

html += `

</div>

<div class="column">

<h2>✅ Completed Orders</h2>
`;

completedOrders.forEach(order => {

let total = 0;

let itemsHTML = order.items.map(item => {
total += item.price * item.quantity;

return `
<div>
${item.name} x${item.quantity}<br>
₹${item.price * item.quantity}
</div><br>
`;

}).join("");

html += `

<div
class="order completed"
data-restaurant="${order.restaurantUsername}"
>

<div class="tick">
✅ Completed
</div><br>

<b>Name:</b>
${order.name || "No Name"}<br>

<b>Mobile:</b>
${order.mobile || "No Mobile"}<br>

<b>Order Type:</b>
${order.orderType || "pickup"}<br>

<b>Time:</b>
${order.time}<br><br>

${itemsHTML}

<h3>Total: ₹${total}</h3>

</div>
`;

});

html += `

</div>

</div>

</div>

<script>

let restaurant = null;

async function login(){

const username =
document.getElementById(
'loginUsername'
).value;

const password =
document.getElementById(
'loginPassword'
).value;

const res = await fetch(
'/restaurant-login',
{
method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({
username,
password
})

});

const data = await res.json();

if(!data.success){

alert(data.message);
return;

}

restaurant = data.restaurant;

localStorage.setItem(
'restaurant',
JSON.stringify(restaurant)
);

document.getElementById(
'loginPage'
).style.display = 'none';

document.getElementById(
'ordersPage'
).style.display = 'block';

startOrders();

}

function startOrders(){

document.getElementById(
"hotelTitle"
).innerText =
restaurant.hotelName + " Orders";

filterOrders();

}

function filterOrders(){

document.querySelectorAll(
'.order'
).forEach(orderCard => {

const username =
orderCard.getAttribute(
'data-restaurant'
);

if(
username !== restaurant.username
){
orderCard.style.display =
'none';
}

});

}

function markDone(index){

fetch("/done/" + index,{
method:"POST"
})
.then(()=>{
location.reload();
});

}

setInterval(()=>{
location.reload();
},3000);

const savedRestaurant =
localStorage.getItem(
'restaurant'
);

if(savedRestaurant){

restaurant =
JSON.parse(savedRestaurant);

document.getElementById(
'loginPage'
).style.display = 'none';

document.getElementById(
'ordersPage'
).style.display = 'block';

startOrders();

}

function logout(){

localStorage.removeItem(
'restaurant'
);

location.reload();

}

</script>

</body>
</html>
`;

res.send(html);

});

// ================= UPGRADED OWNER PANEL =================

app.get("/owner", (req, res, next) => {
  if (req.query.legacy === "1") return next();
  res.sendFile(path.join(__dirname, "public", "owner.html"));
});

// ================= OWNER PANEL =================

app.get("/owner", (req, res) => {

let html = `

<h1>Owner Panel</h1>

<div id="restaurants"></div>

<script>

fetch('/restaurants')
.then(res => res.json())
.then(data => {

document.getElementById(
'restaurants'
).innerHTML =

data.map(r => "

<div style='
border:1px solid black;
padding:15px;
margin-bottom:15px;
border-radius:10px;
'>

<h3>" + r.hotelName + "</h3>

<p>
Owner: " + r.ownerName + "
</p>

<p>
Mobile: " + r.mobile + "
</p>

<p>
Username: " + r.username + "
</p>

<p>
Subscription: " + r.subscriptionStatus + "
</p>

<button onclick='approve(" + r.id + ")'>
Approve
</button>

</div>

").join("");

});

function approve(id){

fetch('/approve-restaurant/' + id,{
method:'POST'
})
.then(() => {
location.reload();
});

}

</script>

`;

res.send(html);

});

// AUTO DELETE AFTER 48 HOURS

const cleanupTimer = setInterval(() => {

  const now = Date.now();

  completedOrders = completedOrders.filter(order => {

    const hours48 =
      48 * 60 * 60 * 1000;

    return now - order.completedAt < hours48;

  });

  fs.writeFileSync(
    "completedOrders.json",
    JSON.stringify(completedOrders, null, 2)
  );

}, 60000);
cleanupTimer.unref();
// ================= START =================

if (require.main === module) {
app.listen(3000, () => {

  console.log("Server running on http://localhost:3000");

});
}

module.exports = app;
