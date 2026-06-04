let customerMobile = localStorage.getItem("customerMobile") || "";

if (!customerMobile) {
  window.location.replace("/login.html");
}

const state = {
  restaurants: [],
  selectedRestaurant: null,
  foods: [],
  category: "All",
  cart: JSON.parse(localStorage.getItem("cart")) || [],
  customerLocation: null,
  recentlyViewed: JSON.parse(localStorage.getItem("recentlyViewedRestaurants")) || [],
  customer: null,
  restaurantFilter: "all",
  restaurantVisibleCount: 6,
  coupon: null
};

const search = document.getElementById("search");
const restaurantView = document.getElementById("restaurant-view");
const restaurantsDiv = document.getElementById("restaurants");
const popularRestaurantsDiv = document.getElementById("popular-restaurants");
const recentRestaurantsDiv = document.getElementById("recent-restaurants");
const recentSection = document.getElementById("recent-section");
const searchSuggestions = document.getElementById("search-suggestions");
const menuView = document.getElementById("menu-view");
const categoriesDiv = document.getElementById("categories");
const foodList = document.getElementById("food-list");
const cartDiv = document.getElementById("cart");
const recommendedSection = document.getElementById("recommended-section");
const recommendedFoodsDiv = document.getElementById("recommended-foods");
const popularDishesSection = document.getElementById("popular-dishes-section");
const popularFoodsDiv = document.getElementById("popular-foods");
const fallbackImage = "/logo.png";
const GST_RATE = 0.05;

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) || url.startsWith("/") ? url : fallbackImage;
}

function showEmpty(container, message) {
  container.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function openModal(html) {
  closeSideMenu();
  document.getElementById("cartBox").classList.remove("show-cart");
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("appModal").hidden = false;
}

function closeModal() {
  document.getElementById("appModal").hidden = true;
  document.getElementById("modalContent").innerHTML = "";
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
}

function money(value) {
  return `&#8377;${Math.round(Number(value) || 0)}`;
}

function currentCartRestaurant() {
  const username = state.cart[0]?.restaurantUsername || state.selectedRestaurant?.username;
  return state.restaurants.find(restaurant => restaurant.username === username) || state.selectedRestaurant;
}

async function loadCustomer() {
  if (!customerMobile) {
    state.customer = {
      name: "Foodza customer",
      mobile: "",
      addresses: [],
      favouriteRestaurants: [],
      favouriteFoods: [],
      wallet: 0,
      referralCode: ""
    };
    renderAddressSelect();
    return;
  }

  try {
    state.customer = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}`);
    renderAddressSelect();
  } catch (error) {
    state.customer = {
      name: localStorage.getItem("customerName"),
      mobile: customerMobile,
      addresses: [],
      favouriteRestaurants: [],
      favouriteFoods: [],
      wallet: 0,
      referralCode: ""
    };
  }
  renderAddressSelect();
}

function renderAddressSelect() {
  const addressSelect = document.getElementById("addressSelect");
  if (!addressSelect) return;

  const addresses = state.customer?.addresses || [];
  addressSelect.innerHTML = addresses.length
    ? addresses.map(address => `
      <option value="${address.id}">
        ${escapeHtml(address.label)} - ${escapeHtml(address.line1 || address.city || "Saved address")}
      </option>
    `).join("")
    : '<option value="">No saved address - share live location</option>';
}

async function ensureCustomerSession() {
  if (customerMobile) return true;

  window.location.href = "/login.html";
  return false;
}

function selectedDeliveryAddress() {
  const id = Number(document.getElementById("addressSelect").value);
  return state.customer?.addresses?.find(address => address.id === id) || null;
}

async function openProfilePage() {
  if (!customerMobile) {
    openModal(`
      <h2>OTP login required</h2>
      <p>Please login with your mobile OTP to manage your profile, addresses, favourites, and orders.</p>
      <button class="checkout-btn" type="button" onclick="window.location.href='/login.html'">Login with OTP</button>
    `);
    return;
  }

  await loadCustomer();
  const addresses = state.customer.addresses || [];
  openModal(`
    <h2>Profile</h2>
    <div class="profile-grid">
      <label>Name<input id="profileEditName" value="${escapeHtml(state.customer.name || "")}"></label>
      <label>Mobile<input id="profileEditMobile" value="${escapeHtml(state.customer.mobile || customerMobile)}"></label>
      <button class="checkout-btn" type="button" onclick="saveProfile()">Save profile</button>
    </div>

    <h3>Saved addresses</h3>
    <div class="address-list">
      ${addresses.length ? addresses.map(address => `
        <div class="address-card">
          <strong>${escapeHtml(address.label)}</strong>
          <p>${escapeHtml(address.line1)} ${escapeHtml(address.landmark || "")}</p>
          <small>${escapeHtml(address.city || "")} ${escapeHtml(address.pincode || "")}</small>
        </div>
      `).join("") : '<p class="muted">No saved addresses yet.</p>'}
    </div>

    <h3>Add address</h3>
    <div class="profile-grid">
      <input id="addressLabel" placeholder="Label, e.g. Home">
      <input id="addressLine1" placeholder="Address line">
      <input id="addressLandmark" placeholder="Landmark">
      <input id="addressCity" placeholder="City">
      <input id="addressPincode" placeholder="Pincode">
      <input id="addressInstructions" placeholder="Delivery instructions">
      <button class="checkout-btn" type="button" onclick="saveAddress()">Save address</button>
    </div>

    <h3>Account extras</h3>
    <p>Wallet: ${money(state.customer.wallet || 0)}</p>
    <p>Referral code: <b>${escapeHtml(state.customer.referralCode || "Coming soon")}</b></p>
    <div class="profile-grid">
      <input id="oldPassword" type="password" placeholder="Current password">
      <input id="newPassword" type="password" placeholder="New password">
      <button type="button" onclick="changePassword()">Change password</button>
    </div>
  `);
}

async function saveProfile() {
  const updated = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("profileEditName").value,
      mobile: document.getElementById("profileEditMobile").value
    })
  });
  state.customer = updated;
  localStorage.setItem("customerName", updated.name);
  localStorage.setItem("customerMobile", updated.mobile);
  customerMobile = updated.mobile;
  alert("Profile saved");
  openProfilePage();
}

async function saveAddress() {
  const address = {
    label: document.getElementById("addressLabel").value || "Home",
    line1: document.getElementById("addressLine1").value,
    landmark: document.getElementById("addressLandmark").value,
    city: document.getElementById("addressCity").value,
    pincode: document.getElementById("addressPincode").value,
    instructions: document.getElementById("addressInstructions").value
  };
  if (!address.line1.trim()) {
    alert("Enter address line");
    return;
  }
  await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(address)
  });
  await loadCustomer();
  alert("Address saved");
  openProfilePage();
}

async function changePassword() {
  const newPassword = document.getElementById("newPassword").value;
  if (newPassword.length < 4) {
    alert("New password must be at least 4 characters");
    return;
  }
  await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oldPassword: document.getElementById("oldPassword").value,
      newPassword
    })
  });
  alert("Password changed");
}

function restaurantLogo(restaurant) {
  return imageUrl(restaurant.logo);
}

function restaurantRating(restaurant) {
  const rating = Number(restaurant.rating);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New";
}

function deliveryTime(restaurant) {
  return restaurant.estimatedDeliveryTime
    ? `${escapeHtml(restaurant.estimatedDeliveryTime)} min`
    : "ETA unavailable";
}

function deliveryCharge(restaurant) {
  return Number(restaurant.deliveryCharge) > 0
    ? `&#8377;${Number(restaurant.deliveryCharge)} delivery`
    : "Free delivery";
}

function restaurantCard(restaurant, index = 0) {
  const status = restaurant.isOpen ? "Open" : "Closed";
  const isFavourite = state.customer?.favouriteRestaurants?.includes(restaurant.username);
  return `
    <article class="restaurant-card${restaurant.isOpen ? "" : " restaurant-card-closed"}" style="--card-index:${index}">
      <button class="favorite-btn" type="button" onclick="toggleFavouriteRestaurant('${escapeHtml(restaurant.username)}')" aria-label="Favourite ${escapeHtml(restaurant.hotelName)}">${isFavourite ? "♥" : "♡"}</button>
      <button class="restaurant-card-action" type="button" data-username="${escapeHtml(restaurant.username)}"${restaurant.isOpen ? "" : " disabled"}>
        <img class="restaurant-logo" src="${escapeHtml(restaurantLogo(restaurant))}" alt="${escapeHtml(restaurant.hotelName)} logo" onerror="this.onerror=null;this.src='${fallbackImage}'">
        <div class="restaurant-details">
          <div class="restaurant-title-row">
            <h3>${escapeHtml(restaurant.hotelName)}</h3>
            <span class="status-badge ${restaurant.isOpen ? "status-open" : "status-closed"}">${status}</span>
          </div>
          <p class="restaurant-city">${escapeHtml(restaurant.city)}</p>
          <div class="restaurant-meta">
            <span class="rating-badge">&#9733; ${restaurantRating(restaurant)}</span>
            <span>${deliveryTime(restaurant)}</span>
            <span>${deliveryCharge(restaurant)}</span>
          </div>
        </div>
      </button>
    </article>
  `;
}

function bindRestaurantCards(container) {
  container.querySelectorAll(".restaurant-card-action:not(:disabled)").forEach(card => {
    card.addEventListener("click", () => selectRestaurant(card.dataset.username));
  });
}

function renderRestaurantCollection(container, restaurants, emptyMessage) {
  if (!restaurants.length) {
    showEmpty(container, emptyMessage);
    return;
  }

  container.innerHTML = restaurants.map(restaurantCard).join("");
  bindRestaurantCards(container);
}

function approvedRestaurants() {
  return state.restaurants.filter(restaurant => restaurant.approved);
}

function restaurantMatchesFilter(restaurant, text) {
  const minRating = Number(document.getElementById("ratingFilter")?.value || 0);
  const maxDeliveryTime = Number(document.getElementById("deliveryFilter")?.value || 999);
  const rating = Number(restaurant.rating || 0);
  const eta = Number(restaurant.estimatedDeliveryTime || 999);
  const favouriteRestaurants = state.customer?.favouriteRestaurants || [];

  return `${restaurant.hotelName} ${restaurant.city}`.toLowerCase().includes(text) &&
    rating >= minRating &&
    eta <= maxDeliveryTime &&
    (
      state.restaurantFilter === "all" ||
      (state.restaurantFilter === "open" && restaurant.isOpen) ||
      (state.restaurantFilter === "free" && Number(restaurant.deliveryCharge) === 0) ||
      (state.restaurantFilter === "top" && rating >= 4) ||
      (state.restaurantFilter === "fast" && eta <= 30) ||
      (state.restaurantFilter === "favourites" && favouriteRestaurants.includes(restaurant.username))
    );
}

function sortRestaurants(restaurants) {
  const sortBy = document.getElementById("sortFilter")?.value || "recommended";
  return restaurants.slice().sort((a, b) => {
    if (sortBy === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
    if (sortBy === "eta") return Number(a.estimatedDeliveryTime || 999) - Number(b.estimatedDeliveryTime || 999);
    if (sortBy === "delivery") return Number(a.deliveryCharge || 0) - Number(b.deliveryCharge || 0);
    return Number(b.popular || 0) - Number(a.popular || 0) || Number(b.rating || 0) - Number(a.rating || 0);
  });
}

function saveRecentlyViewed(username) {
  state.recentlyViewed = [
    username,
    ...state.recentlyViewed.filter(item => item !== username)
  ].slice(0, 4);
  localStorage.setItem("recentlyViewedRestaurants", JSON.stringify(state.recentlyViewed));
}

function renderRecentlyViewed() {
  const restaurants = state.recentlyViewed
    .map(username => state.restaurants.find(restaurant => restaurant.username === username))
    .filter(restaurant => restaurant && restaurant.approved);

  recentSection.hidden = restaurants.length === 0;
  if (restaurants.length) {
    renderRestaurantCollection(recentRestaurantsDiv, restaurants, "");
  }
}

function clearRecentlyViewed() {
  state.recentlyViewed = [];
  localStorage.removeItem("recentlyViewedRestaurants");
  renderRecentlyViewed();
}

function renderSuggestions() {
  if (state.selectedRestaurant) {
    searchSuggestions.hidden = true;
    return;
  }

  const text = search.value.trim().toLowerCase();
  if (!text) {
    searchSuggestions.hidden = true;
    return;
  }

  const matches = approvedRestaurants()
    .filter(restaurant =>
      `${restaurant.hotelName} ${restaurant.city}`.toLowerCase().includes(text)
    )
    .slice(0, 5);

  if (!matches.length) {
    searchSuggestions.hidden = true;
    return;
  }

  searchSuggestions.innerHTML = matches.map(restaurant => `
    <button class="suggestion-item" type="button" data-username="${escapeHtml(restaurant.username)}"${restaurant.isOpen ? "" : " disabled"}>
      <img src="${escapeHtml(restaurantLogo(restaurant))}" alt="">
      <span>
        <strong>${escapeHtml(restaurant.hotelName)}</strong>
        <small>${escapeHtml(restaurant.city)} &middot; ${restaurant.isOpen ? "Open" : "Closed"}</small>
      </span>
    </button>
  `).join("");

  bindRestaurantCards(searchSuggestions);
  searchSuggestions.querySelectorAll(".suggestion-item:not(:disabled)").forEach(card => {
    card.addEventListener("click", () => selectRestaurant(card.dataset.username));
  });
  searchSuggestions.hidden = false;
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
}

async function loadRestaurants() {
  try {
    state.restaurants = await fetchJson("/restaurants");
    renderRestaurants();
  } catch (error) {
    console.error(error);
    showEmpty(restaurantsDiv, "Restaurants could not be loaded. Please try again.");
  }
}

function renderRestaurants() {
  const text = search.value.trim().toLowerCase();
  const restaurants = sortRestaurants(
    approvedRestaurants().filter(restaurant => restaurantMatchesFilter(restaurant, text))
  );
  const visibleRestaurants = restaurants.slice(0, state.restaurantVisibleCount);

  document.getElementById("restaurant-count").textContent =
    `${restaurants.length} ${restaurants.length === 1 ? "restaurant" : "restaurants"}`;
  renderRestaurantCollection(restaurantsDiv, visibleRestaurants, "No restaurants found.");
  const loadMoreButton = document.getElementById("loadMoreRestaurants");
  if (loadMoreButton) {
    loadMoreButton.hidden = visibleRestaurants.length >= restaurants.length;
  }

  const markedPopularRestaurants = approvedRestaurants()
    .filter(restaurant => restaurant.popular && restaurant.isOpen)
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const popularRestaurants = markedPopularRestaurants.length
    ? markedPopularRestaurants
    : approvedRestaurants().filter(restaurant => restaurant.isOpen).slice(0, 3);
  renderRestaurantCollection(
    popularRestaurantsDiv,
    popularRestaurants,
    "Popular restaurants will appear here soon."
  );
  renderRecentlyViewed();
  renderSuggestions();
}

function setRestaurantFilter(filter) {
  state.restaurantFilter = filter;
  state.restaurantVisibleCount = 6;
  document.querySelectorAll(".filter-chip").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderRestaurants();
}

function loadMoreRestaurants() {
  state.restaurantVisibleCount += 6;
  renderRestaurants();
}

async function toggleFavouriteRestaurant(username) {
  if (!customerMobile) {
    alert("Login with OTP to save favourites.");
    return;
  }
  try {
    state.customer = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/favourite-restaurant/${encodeURIComponent(username)}`, {
      method: "POST"
    });
    renderRestaurants();
  } catch (error) {
    alert("Could not update favourite restaurant");
  }
}

async function selectRestaurant(username) {
  const restaurant = state.restaurants.find(item => item.username === username);
  if (!restaurant || !restaurant.isOpen) return;

  state.selectedRestaurant = restaurant;
  saveRecentlyViewed(username);
  state.foods = [];
  state.category = "All";
  search.value = "";
  search.placeholder = "Search food...";
  restaurantView.hidden = true;
  menuView.hidden = false;
  document.getElementById("back-btn").hidden = false;
  searchSuggestions.hidden = true;
  document.getElementById("selected-restaurant-name").textContent = restaurant.hotelName;
  document.getElementById("selected-restaurant-city").textContent = restaurant.city;
  showEmpty(foodList, "Loading menu...");

  try {
    state.foods = await fetchJson(`/menu/${encodeURIComponent(username)}`);
    enrichFoods();
    renderCategories();
    renderMenuShowcases();
    renderFoods();
  } catch (error) {
    console.error(error);
    categoriesDiv.innerHTML = "";
    showEmpty(foodList, "Menu could not be loaded. Please try again.");
  }
}

function showRestaurants() {
  state.selectedRestaurant = null;
  state.foods = [];
  state.category = "All";
  search.value = "";
  search.placeholder = "Search restaurants...";
  menuView.hidden = true;
  restaurantView.hidden = false;
  document.getElementById("back-btn").hidden = true;
  renderRestaurants();
}

function foodImages(food) {
  const gallery = Array.isArray(food.gallery) ? food.gallery : [];
  return [food.image, ...gallery]
    .map(imageUrl)
    .filter((src, index, list) => src && list.indexOf(src) === index);
}

function enrichFoods() {
  state.foods = state.foods.map(food => ({
    description: "Freshly prepared with Foodza quality standards.",
    rating: 0,
    foodType: "veg",
    bestseller: false,
    recommended: false,
    popular: false,
    gallery: [],
    ...food
  }));
}

function foodRating(food) {
  const rating = Number(food.rating);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New";
}

function foodTypeBadge(food) {
  const type = String(food.foodType || "veg").toLowerCase() === "non-veg" ? "non-veg" : "veg";
  return `<span class="food-type ${type === "veg" ? "veg-badge" : "non-veg-badge"}">${type === "veg" ? "Veg" : "Non-Veg"}</span>`;
}

function setFoodImage(id, src) {
  const image = document.getElementById(`food-img-${id}`);
  if (image) image.src = src;
}

function foodCard(food, compact = false) {
  const images = foodImages(food);
  const primaryImage = images[0] || fallbackImage;
  const isFavourite = state.customer?.favouriteFoods?.includes(Number(food.id));
  const badgeHtml = [
    foodTypeBadge(food),
    food.bestseller ? '<span class="food-pill bestseller-pill">Bestseller</span>' : "",
    food.recommended ? '<span class="food-pill recommended-pill">Recommended</span>' : ""
  ].join("");

  return `
    <article class="food-item${compact ? " food-item-compact" : ""}">
      <button class="favorite-btn food-favorite" type="button" onclick="toggleFavouriteFood(${Number(food.id)})" aria-label="Favourite ${escapeHtml(food.name)}">${isFavourite ? "♥" : "♡"}</button>
      <div class="food-gallery">
        <img id="food-img-${escapeHtml(food.id)}" class="food-img" loading="lazy" src="${escapeHtml(primaryImage)}" alt="${escapeHtml(food.name)}" onerror="this.onerror=null;this.src='${fallbackImage}'">
        ${images.length > 1 ? `
          <div class="gallery-thumbs">
            ${images.slice(0, 4).map(src => `
              <button type="button" onclick="setFoodImage(${Number(food.id)}, '${escapeHtml(src)}')" aria-label="View ${escapeHtml(food.name)} image">
                <img src="${escapeHtml(src)}" alt="">
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>
      <div class="food-details">
        <div class="food-badges">${badgeHtml}</div>
        <strong>${escapeHtml(food.name)}</strong>
        <p class="food-description">${escapeHtml(food.description)}</p>
        <div class="food-meta">
          <span class="rating-badge">&#9733; ${foodRating(food)}</span>
          <span>${escapeHtml(food.category || "Other")}</span>
        </div>
        <div class="food-card-bottom">
          <div>
            <p class="food-price">${money(food.price)}</p>
            <input id="custom-${escapeHtml(food.id)}" type="text" placeholder="Customisation">
          </div>
          <button class="add-btn" type="button" onclick="addToCart(${Number(food.id)})" aria-label="Add ${escapeHtml(food.name)}">Add</button>
        </div>
      </div>
    </article>
  `;
}

async function toggleFavouriteFood(id) {
  if (!customerMobile) {
    alert("Login with OTP to save favourites.");
    return;
  }
  try {
    state.customer = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/favourite-food/${id}`, {
      method: "POST"
    });
    renderMenuShowcases();
    renderFoods();
  } catch (error) {
    alert("Could not update favourite food");
  }
}

function renderFoodCollection(container, foods, emptyMessage, compact = false) {
  if (!foods.length) {
    showEmpty(container, emptyMessage);
    return;
  }

  container.innerHTML = foods.map(food => foodCard(food, compact)).join("");
}

function renderMenuShowcases() {
  const recommendedFoods = state.foods.filter(food => food.recommended);
  const popularFoods = state.foods
    .filter(food => food.popular || food.bestseller || Number(food.rating) >= 4)
    .slice(0, 8);
  const fallbackRecommended = recommendedFoods.length ? recommendedFoods : state.foods.slice(0, 4);
  const fallbackPopular = popularFoods.length ? popularFoods : state.foods.slice(0, 4);

  recommendedSection.hidden = fallbackRecommended.length === 0;
  popularDishesSection.hidden = fallbackPopular.length === 0;

  if (fallbackRecommended.length) {
    renderFoodCollection(recommendedFoodsDiv, fallbackRecommended, "", true);
  }

  if (fallbackPopular.length) {
    renderFoodCollection(popularFoodsDiv, fallbackPopular, "", true);
  }
}

function renderCategories() {
  const categories = ["All", ...new Set(
    state.foods
      .map(food => String(food.category || "").trim())
      .filter(Boolean)
  )];

  categoriesDiv.innerHTML = categories.map(category => `
    <button class="cat${category === state.category ? " active" : ""}" type="button" data-category="${escapeHtml(category)}">
      ${escapeHtml(category)}
    </button>
  `).join("");

  categoriesDiv.querySelectorAll(".cat").forEach(button => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderCategories();
      renderFoods();
      foodList.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const activeButton = categoriesDiv.querySelector(".cat.active");
  if (activeButton) {
    activeButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function renderFoods() {
  const text = search.value.trim().toLowerCase();
  const foods = state.foods.filter(food => {
    const matchesSearch = String(food.name || "").toLowerCase().includes(text);
    const matchesCategory = state.category === "All" || food.category === state.category;
    return matchesSearch && matchesCategory;
  });

  if (!foods.length) {
    showEmpty(foodList, "No food items found.");
    return;
  }

  renderFoodCollection(foodList, foods, "No food items found.");
}

function addToCart(id) {
  const item = state.foods.find(food => food.id === id);
  if (!item || !state.selectedRestaurant) return;

  if (state.cart.some(cartItem =>
    cartItem.restaurantUsername !== state.selectedRestaurant.username
  )) {
    alert("Your cart contains items from another restaurant. Clear the cart before adding this item.");
    return;
  }

  const customInput = document.getElementById(`custom-${id}`);
  const custom = customInput.value.trim();
  const existing = state.cart.find(cartItem =>
    cartItem.id === id &&
    cartItem.custom === custom &&
    cartItem.restaurantUsername === state.selectedRestaurant.username
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      ...item,
      restaurantUsername: state.selectedRestaurant.username,
      quantity: 1,
      custom
    });
  }

  customInput.value = "";
  saveCart();
  renderCart();
}

function changeQuantity(index, amount) {
  const item = state.cart[index];
  if (!item) return;

  item.quantity += amount;
  if (item.quantity <= 0) {
    state.cart.splice(index, 1);
  }

  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(state.cart));
}

function renderCart() {
  const itemCount = state.cart.reduce((total, item) => total + item.quantity, 0);
  document.getElementById("cart-count").textContent = itemCount;
  document.getElementById("cartRestaurant").textContent = currentCartRestaurant()?.hotelName || "";

  if (!state.cart.length) {
    showEmpty(cartDiv, "Your cart is empty.");
    document.getElementById("cartRestaurant").textContent = "Add dishes to start an order";
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const restaurant = currentCartRestaurant();
  const deliveryFee = document.getElementById("orderType").value === "delivery"
    ? Number(restaurant?.deliveryCharge || 0)
    : 0;
  const discount = discountAmount(subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const gst = taxable * GST_RATE;
  const grandTotal = taxable + deliveryFee + gst;

  cartDiv.innerHTML = state.cart.map((item, index) => `
    <div class="cart-item">
      <div class="cart-item-main">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.custom || "No customisation")}</small>
        <p>${money(Number(item.price) * item.quantity)}</p>
      </div>
      <div class="qty-box">
        <button class="qty-btn" type="button" onclick="changeQuantity(${index}, -1)">-</button>
        <span>${item.quantity}</span>
        <button class="qty-btn" type="button" onclick="changeQuantity(${index}, 1)">+</button>
      </div>
      <button class="remove-item" type="button" onclick="removeCartItem(${index})">Remove</button>
    </div>
  `).join("") + `
    <section class="order-summary">
      <h3>Order summary</h3>
      <div><span>Item total</span><strong>${money(subtotal)}</strong></div>
      <div><span>Coupon discount</span><strong>${discount ? "-" + money(discount) : "None"}</strong></div>
      <div><span>Delivery charge</span><strong>${deliveryFee ? money(deliveryFee) : "Free"}</strong></div>
      <div><span>GST (5%)</span><strong>${money(gst)}</strong></div>
      <div class="grand-total"><span>Grand total</span><strong>${money(grandTotal)}</strong></div>
    </section>
  `;
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = [];
  saveCart();
  renderCart();
}

function toggleCart() {
  document.getElementById("cartBox").classList.toggle("show-cart");
}

async function checkout() {
  if (!state.cart.length) {
    alert("Your cart is empty");
    return;
  }

  const restaurantUsernames = [...new Set(state.cart.map(item => item.restaurantUsername))];
  if (restaurantUsernames.length !== 1) {
    alert("Please order from one restaurant at a time");
    return;
  }

  const orderType = document.getElementById("orderType").value;
  const hasCustomer = await ensureCustomerSession();
  if (!hasCustomer) return;

  if (orderType === "delivery" && !state.customerLocation) {
    if (!selectedDeliveryAddress()) {
      alert("Please select a saved address or share delivery location");
      return;
    }
  }

  try {
    const order = await fetchJson("/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: localStorage.getItem("customerName"),
        mobile: customerMobile,
        orderType,
        table: null,
        address: orderType === "delivery" ? selectedDeliveryAddress() : null,
        instructions: document.getElementById("deliveryInstructions").value,
        paymentMethod: document.getElementById("paymentMethod").value,
        location: orderType === "delivery" ? state.customerLocation : null,
        items: state.cart,
        restaurantUsername: restaurantUsernames[0],
        pricing: buildPricingSummary(),
        time: new Date().toLocaleString()
      })
    });

    showOrderConfirmation(order);
    clearCart();
    document.getElementById("locationStatus").textContent = "";
    state.customerLocation = null;
    toggleCart();
  } catch (error) {
    alert(error.message || "Order could not be placed");
  }
}

function buildPricingSummary() {
  const subtotal = state.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const restaurant = currentCartRestaurant();
  const deliveryFee = document.getElementById("orderType").value === "delivery"
    ? Number(restaurant?.deliveryCharge || 0)
    : 0;
  const discount = discountAmount(subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const gst = taxable * GST_RATE;
  return {
    subtotal,
    discount,
    deliveryFee,
    gst,
    grandTotal: taxable + deliveryFee + gst
  };
}

function discountAmount(subtotal) {
  if (!state.coupon) return 0;
  if (state.coupon.type === "percent") {
    return subtotal * (Number(state.coupon.value) / 100);
  }
  return Number(state.coupon.value || 0);
}

async function applyCoupon() {
  const code = document.getElementById("couponCode").value.trim().toUpperCase();
  if (!code) {
    alert("Enter coupon code");
    return;
  }
  const coupons = await fetchJson("/coupons");
  const coupon = coupons.find(item => item.code.toUpperCase() === code);
  if (!coupon) {
    state.coupon = null;
    renderCart();
    alert("Invalid coupon");
    return;
  }
  state.coupon = coupon;
  renderCart();
  alert("Coupon applied");
}

function showOrderConfirmation(order) {
  const paymentLabel = {
    cod: "Cash on delivery",
    upi: "UPI payment placeholder",
    wallet: "Foodza wallet"
  }[order.paymentMethod] || "Cash on delivery";

  openModal(`
    <h2>Order confirmed</h2>
    <p class="muted">Order ID</p>
    <h3>${escapeHtml(order.orderId)}</h3>
    <p>Estimated delivery time: <b>${escapeHtml(order.estimatedDeliveryTime)} min</b></p>
    <p>Payment: ${paymentLabel}</p>
    <button class="checkout-btn" type="button" onclick="trackOrder('${escapeHtml(order.orderId)}')">Track order</button>
  `);
}

async function trackOrder(orderId) {
  const order = await fetchJson(`/order-status/${encodeURIComponent(orderId)}`);
  const steps = [
    ["received", "Order received"],
    ["preparing", "Preparing food"],
    ["packed", "Packed"],
    ["out_for_delivery", "Out for delivery"],
    ["delivered", "Delivered"]
  ];
  const currentIndex = Math.max(0, steps.findIndex(([status]) => status === order.status));
  openModal(`
    <h2>Live order tracking</h2>
    <p class="muted">Order ID: ${escapeHtml(order.orderId)}</p>
    <div class="tracker">
      ${steps.map(([status, label], index) => `
        <div class="tracker-step ${index <= currentIndex ? "done" : ""}">
          <span>${index + 1}</span>
          <strong>${label}</strong>
        </div>
      `).join("")}
    </div>
    <h3>Status history</h3>
    ${(order.statusHistory || []).map(item => `
      <div class="history-card">
        <strong>${escapeHtml(item.status)}</strong>
        <p>${new Date(item.time).toLocaleString()}</p>
      </div>
    `).join("")}
    <p>Estimated delivery: ${escapeHtml(order.estimatedDeliveryTime || 35)} min</p>
  `);
}

async function showOrderHistory() {
  if (!customerMobile) {
    openModal(`
      <h2>Order history</h2>
      <p>Login with mobile OTP to view order history.</p>
      <button class="checkout-btn" type="button" onclick="window.location.href='/login.html'">Login with OTP</button>
    `);
    return;
  }
  const history = await fetchJson(`/customer-history/${encodeURIComponent(customerMobile)}`);
  openModal(`
    <h2>Order history</h2>
    ${history.length ? history.map(order => `
      <div class="history-card">
        <strong>${escapeHtml(order.orderId || order.id)}</strong>
        <p>${escapeHtml(order.restaurantUsername)} · ${escapeHtml(order.status || (order.done ? "delivered" : "received"))}</p>
        <small>${escapeHtml(order.time || new Date(order.createdAt).toLocaleString())}</small>
        ${order.orderId ? `<button type="button" onclick="trackOrder('${escapeHtml(order.orderId)}')">Track</button>` : ""}
      </div>
    `).join("") : '<p class="muted">No orders yet.</p>'}
  `);
}

async function showRecommendations() {
  if (!customerMobile) {
    openModal(`
      <h2>AI recommendations</h2>
      <p>Login with mobile OTP to get recommendations based on orders and favourites.</p>
      <button class="checkout-btn" type="button" onclick="window.location.href='/login.html'">Login with OTP</button>
    `);
    return;
  }
  const data = await fetchJson(`/recommendations/${encodeURIComponent(customerMobile)}`);
  openModal(`
    <h2>AI recommendations</h2>
    <p class="muted">Prototype recommendations based on favourites, ratings, and past orders.</p>
    <h3>Restaurants</h3>
    ${data.restaurants.length ? data.restaurants.map(restaurant => `
      <div class="history-card">
        <strong>${escapeHtml(restaurant.hotelName)}</strong>
        <p>${escapeHtml(restaurant.city)} · ${restaurantRating(restaurant)} ★</p>
      </div>
    `).join("") : '<p class="muted">No restaurant recommendations yet.</p>'}
    <h3>Foods</h3>
    ${data.foods.length ? data.foods.map(food => `
      <div class="history-card">
        <strong>${escapeHtml(food.name)}</strong>
        <p>${escapeHtml(food.category)} · ${money(food.price)}</p>
      </div>
    `).join("") : '<p class="muted">No food recommendations yet.</p>'}
  `);
}

async function showTrendingFoods() {
  const foods = await fetchJson("/trending-foods");
  openModal(`
    <h2>Trending foods</h2>
    <p class="muted">Popular dishes based on orders and menu popularity.</p>
    ${foods.length ? foods.map(food => `
      <div class="history-card">
        <strong>${escapeHtml(food.name)}</strong>
        <p>${escapeHtml(food.category || "Food")} - ${money(food.price)} - Ordered ${Number(food.quantity || 0)} times</p>
      </div>
    `).join("") : '<p class="muted">No trending foods yet.</p>'}
  `);
}

async function showFavouriteRestaurants() {
  await loadCustomer();
  const favourites = approvedRestaurants()
    .filter(restaurant => state.customer?.favouriteRestaurants?.includes(restaurant.username));

  openModal(`
    <h2>Favourite restaurants</h2>
    ${favourites.length ? favourites.map(restaurant => `
      <div class="history-card">
        <strong>${escapeHtml(restaurant.hotelName)}</strong>
        <p>${escapeHtml(restaurant.city)} - ${restaurantRating(restaurant)} star - ${restaurant.isOpen ? "Open" : "Closed"}</p>
        <button type="button" onclick="closeModal(); selectRestaurant('${escapeHtml(restaurant.username)}')">Open menu</button>
      </div>
    `).join("") : '<p class="muted">No favourite restaurants yet. Tap the heart on restaurant cards.</p>'}
  `);
}

async function showFavouriteFoods() {
  await loadCustomer();
  const favouriteIds = state.customer?.favouriteFoods || [];
  const allMenus = await Promise.all(approvedRestaurants().map(restaurant =>
    fetchJson(`/menu/${encodeURIComponent(restaurant.username)}`).catch(() => [])
  ));
  const favourites = allMenus.flat().filter(food => favouriteIds.includes(Number(food.id)));

  openModal(`
    <h2>Favourite foods</h2>
    ${favourites.length ? favourites.map(food => `
      <div class="history-card">
        <strong>${escapeHtml(food.name)}</strong>
        <p>${escapeHtml(food.category || "Food")} - ${money(food.price)}</p>
      </div>
    `).join("") : '<p class="muted">No favourite foods yet. Tap the heart on food cards.</p>'}
  `);
}

async function showWalletReferral() {
  await loadCustomer();
  openModal(`
    <h2>Wallet & referral</h2>
    <div class="history-card">
      <strong>Wallet balance</strong>
      <p>${money(state.customer.wallet || 0)}</p>
    </div>
    <div class="profile-grid">
      <input id="walletAmount" type="number" min="1" placeholder="Top-up amount">
      <button class="checkout-btn" type="button" onclick="topUpWallet()">Add money to wallet</button>
    </div>
    <div class="history-card">
      <strong>Your referral code</strong>
      <p>${escapeHtml(state.customer.referralCode || "Coming soon")}</p>
    </div>
    <div class="profile-grid">
      <input id="referralCodeInput" placeholder="Apply referral code">
      <button type="button" onclick="applyReferralCode()">Apply referral</button>
    </div>
  `);
}

async function topUpWallet() {
  const amount = Number(document.getElementById("walletAmount").value || 0);
  try {
    state.customer = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/wallet/topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });
    localStorage.setItem("customer", JSON.stringify(state.customer));
    showWalletReferral();
  } catch (error) {
    openModal(`
      <h2>Wallet top-up failed</h2>
      <p>${escapeHtml(error.message || "Enter a valid top-up amount.")}</p>
      <button class="checkout-btn" type="button" onclick="showWalletReferral()">Try again</button>
    `);
  }
}

async function applyReferralCode() {
  const code = document.getElementById("referralCodeInput").value;
  try {
    state.customer = await fetchJson(`/customer/${encodeURIComponent(customerMobile)}/referral/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    localStorage.setItem("customer", JSON.stringify(state.customer));
    showWalletReferral();
  } catch (error) {
    openModal(`
      <h2>Referral failed</h2>
      <p>${escapeHtml(error.message || "Referral code could not be applied.")}</p>
      <button class="checkout-btn" type="button" onclick="showWalletReferral()">Try again</button>
    `);
  }
}

function detectCustomerLocation() {
  if (!navigator.geolocation) {
    alert("Location detection is not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(position => {
    state.customerLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      mapsLink: `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`
    };
    openModal(`
      <h2>Location detected</h2>
      <p>Your location was captured for delivery checkout.</p>
      <a href="${state.customerLocation.mapsLink}" target="_blank">Open on map</a>
    `);
  }, () => openModal(`
    <h2>Location not enabled</h2>
    <p>Location permission was denied. You can still use saved addresses during delivery checkout.</p>
  `));
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    openModal(`
      <h2>Push notifications</h2>
      <p>Push notifications are not supported in this browser.</p>
    `);
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification("Foodza notifications enabled", {
      body: "We can now show order updates on this device."
    });
    openModal(`
      <h2>Notifications enabled</h2>
      <p>Foodza can now show order updates on this device.</p>
    `);
  } else {
    openModal(`
      <h2>Notifications not enabled</h2>
      <p>Notification permission was not granted.</p>
    `);
  }
}

function toggleOrderType() {
  const isDelivery = document.getElementById("orderType").value === "delivery";
  document.getElementById("deliveryBox").hidden = !isDelivery;
  renderCart();
}

function getLiveLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    state.customerLocation = {
      latitude,
      longitude,
      mapsLink: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
    document.getElementById("locationStatus").textContent = "Location shared";
  }, () => alert("Location access denied"));
}

function toggleProfilePopup() {
  const popup = document.getElementById("profilePopup");
  popup.hidden = !popup.hidden;
  document.getElementById("profileName").textContent = localStorage.getItem("customerName") || "Foodza customer";
  document.getElementById("profileMobile").textContent = customerMobile || "OTP login required";
}

function toggleSideMenu() {
  const menu = document.getElementById("sideMenu");
  menu.classList.toggle("open");
  menu.setAttribute("aria-hidden", String(!menu.classList.contains("open")));
}

function closeSideMenu() {
  const menu = document.getElementById("sideMenu");
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
}

async function showOrders() {
  if (!customerMobile) {
    openModal(`
      <h2>My orders</h2>
      <p>Login with mobile OTP to view your saved orders.</p>
      <button class="checkout-btn" type="button" onclick="window.location.href='/login.html'">Login with OTP</button>
    `);
    return;
  }
  try {
    const orders = await fetchJson(`/customer-orders/${encodeURIComponent(customerMobile)}`);
    if (!orders.length) {
      openModal(`
        <h2>My orders</h2>
        <p class="muted">No current orders.</p>
      `);
      return;
    }

    openModal(`
      <h2>My orders</h2>
      ${orders.map((order, index) => `
        <div class="history-card">
          <strong>Order ${index + 1}: ${escapeHtml(order.orderId || order.id)}</strong>
          <p>${escapeHtml(order.restaurantUsername)} - ${escapeHtml(order.status || "received")}</p>
          <small>${order.items.map(item => `${escapeHtml(item.name)} x${item.quantity}`).join(", ")}</small>
          ${order.orderId ? `<button type="button" onclick="trackOrder('${escapeHtml(order.orderId)}')">Track</button>` : ""}
        </div>
      `).join("")}
    `);
  } catch (error) {
    openModal(`
      <h2>My orders</h2>
      <p>Orders could not be loaded. Please try again.</p>
    `);
  }
}

function logout() {
  localStorage.removeItem("customerMobile");
  localStorage.removeItem("customerName");
  localStorage.removeItem("cart");
  localStorage.removeItem("customer");
  customerMobile = "";
  state.customer = null;
  window.location.replace("/");
}

search.addEventListener("input", () => {
  if (state.selectedRestaurant) {
    renderFoods();
  } else {
    state.restaurantVisibleCount = 6;
    renderRestaurants();
  }
});

search.addEventListener("focus", renderSuggestions);

document.addEventListener("click", event => {
  if (!event.target.closest(".search-box") && !event.target.closest(".search-suggestions")) {
    searchSuggestions.hidden = true;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

async function startApp() {
  await loadCustomer();
  await loadRestaurants();
  renderCart();
}

startApp();
