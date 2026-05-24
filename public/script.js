const customerMobile =
localStorage.getItem("customerMobile");

if(!customerMobile){

  window.location.href = "/login.html";

}

let foods = [];

let cart =
JSON.parse(localStorage.getItem("cart")) || [];

const foodList =
document.getElementById("food-list");

const cartDiv =
document.getElementById("cart");

const search =
document.getElementById("search");


// LOAD MENU

function loadFoods(){

  fetch("/menu")

  .then(res => res.json())

  .then(data => {

    foods = data;

    displayFoods(foods);

  });

}


// DISPLAY FOOD

function displayFoods(items){

  foodList.innerHTML = "";

  items.forEach(food => {

    foodList.innerHTML += `

    <div class="food-item">

      <div class="food-left">

        <div class="food-icon">
          🍽️
        </div>

        <div class="food-details">

          <strong>${food.name}</strong>

          <div class="food-no">
            No. ${food.id}
          </div>

          <div class="food-price">
            ${food.price ? "₹" + food.price : "APS"}
          </div>

          <input
          type="text"
          placeholder="Customisation"
          id="custom-${food.id}"
          >

        </div>

      </div>

      <button onclick="addToCart(${food.id})">
        +
      </button>

    </div>

    `;

  });

}


// ADD TO CART

function addToCart(id){

  const item =
  foods.find(f => f.id === id);

  const custom =
  document.getElementById(`custom-${id}`).value;

  const existing =
  cart.find(c =>
    c.id === id &&
    c.custom === custom
  );

  if(existing){

    existing.quantity++;

  }else{

    cart.push({

      ...item,

      quantity:1,

      custom

    });

  }

  saveCart();

  displayCart();

}


// REMOVE ITEM

function removeFromCart(id){

  const item =
  cart.find(c => c.id === id);

  if(item.quantity > 1){

    item.quantity--;

  }else{

    cart =
    cart.filter(c => c.id !== id);

  }

  saveCart();

  displayCart();

}


// SAVE CART

function saveCart(){

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

}


// DISPLAY CART

function displayCart(){

  cartDiv.innerHTML = "";

  if(cart.length === 0){

    cartDiv.innerHTML =
    "Cart is empty";

    document
    .getElementById("cart-count")
    .innerText = 0;

    return;

  }

  let total = 0;

  cart.forEach(item => {

    if(item.price){

      total +=
      item.price * item.quantity;

    }

    cartDiv.innerHTML += `

    <div class="cart-item">

      <div>

        ${item.name} (x${item.quantity})<br>

        <small>
        ${item.custom || ""}
        </small><br>

        ${item.price
          ? "₹" + (item.price * item.quantity)
          : "APS"}

      </div>

      <button onclick="removeFromCart(${item.id})">
        -
      </button>

    </div>

    `;

  });

  cartDiv.innerHTML += `

  <div class="cart-total">

    Total: ₹${total}

  </div>

  `;

  document
  .getElementById("cart-count")
  .innerText = cart.length;

}


// CHECKOUT
function checkout(){

  const orderType =
  document.getElementById("orderType").value;

  const tableNo =
  document.getElementById("tableNo").value;

  // DINE IN CHECK

  if(orderType === "dinein" && !tableNo){

    alert("Please enter table number");

    return;

  }

  // DELIVERY CHECK

  if(orderType === "delivery" && !customerLocation){

    alert("Please share delivery location");

    return;

  }

  fetch("/order", {

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({

      name:
      localStorage.getItem("customerName"),

      mobile:
      localStorage.getItem("customerMobile"),

      orderType:orderType,

      table:
      orderType === "dinein"
      ? tableNo
      : null,

      location:
      orderType === "delivery"
      ? customerLocation
      : null,

      items:cart,

      time:new Date().toLocaleString()

    })

  })

  .then(() => {

    alert("Order placed!");
    const oldOrders =
JSON.parse(
  localStorage.getItem("customerOrders")
) || [];

oldOrders.push({

  items: cart,

  time: new Date().toLocaleString(),

  done:false

});

localStorage.setItem(
  "customerOrders",
  JSON.stringify(oldOrders)
);

    cart = [];

    saveCart();

    displayCart();

    document.getElementById(
      "tableNo"
    ).value = "";

    document.getElementById(
      "locationStatus"
    ).innerHTML = "";

    customerLocation = null;

    toggleCart();

  });

}


// SEARCH

search.addEventListener("input", function(){

  const text =
  search.value
  .toLowerCase()
  .trim();

  const filteredFoods =
  foods.filter(food => {

    const fullName =
    food.name.toLowerCase();

    if(fullName.includes(text)){

      return true;

    }

    const initials =
    food.name

    .split(" ")

    .map(word =>
      word[0].toLowerCase()
    )

    .join("");

    return initials.includes(text);

  });

  displayFoods(filteredFoods);

});



// TOGGLE CART

function toggleCart(){

  document

  .getElementById("cartBox")

  .classList

  .toggle("show-cart");

}

function clearCart(){

  cart = [];

  saveCart();

  displayCart();

}


// CLEAR CART

function clearCart(){

  cart = [];

  saveCart();

  displayCart();

}


// LOGOUT

function logout(){

  localStorage.removeItem("customerMobile");

  localStorage.removeItem("customerName");

  window.location.href =
  "/login.html";

}

function filterCategory(category) {

  // active button
  document
  .querySelectorAll(".cat")
  .forEach(btn => {
    btn.classList.remove("active");
  });

  // highlight clicked button
  const activeBtn =
  Array.from(document.querySelectorAll(".cat"))
  .find(btn => btn.innerText.trim() === category);

  if(activeBtn){
    activeBtn.classList.add("active");
  }

  // show all
  if(category === "All"){
    displayFoods(foods);
    return;
  }

  // filter category
  const filtered =
  foods.filter(food =>
    food.category &&
    food.category.trim() === category
  );

  displayFoods(filtered);
}

let customerLocation = null;


// TOGGLE DINE IN / DELIVERY

function toggleOrderType(){

  const type =
  document.getElementById("orderType").value;

  const deliveryBox =
  document.getElementById("deliveryBox");

  const tableNo =
  document.getElementById("tableNo");

  if(type === "delivery"){

    deliveryBox.style.display = "block";

    tableNo.style.display = "none";

  }else{

    deliveryBox.style.display = "none";

    tableNo.style.display = "block";

  }

}


// GET LIVE LOCATION

function getLiveLocation(){

  if(!navigator.geolocation){

    alert("Geolocation not supported");

    return;

  }

  navigator.geolocation.getCurrentPosition(

    position => {

      const lat =
      position.coords.latitude;

      const lng =
      position.coords.longitude;

      customerLocation = {

        latitude: lat,

        longitude: lng,

        mapsLink:
        `https://www.google.com/maps?q=${lat},${lng}`

      };

      document.getElementById(
        "locationStatus"
      ).innerHTML =
      "✅ Location Shared";

    },

    () => {

      alert("Location access denied");

    }

  );

}

function toggleProfilePopup(){

  const popup =
  document.getElementById("profilePopup");

  if(
    popup.style.display === "block"
  ){

    popup.style.display = "none";

  }else{

    document.getElementById(
      "profileName"
    ).innerText =
    localStorage.getItem("customerName");

    document.getElementById(
      "profileMobile"
    ).innerText =
    localStorage.getItem("customerMobile");

    popup.style.display = "block";

  }

}

function toggleSideMenu(){

  const menu =
  document.getElementById("sideMenu");

  if(menu.style.left === "0px"){

    menu.style.left = "-280px";

  }else{

    menu.style.left = "0px";

  }

}


// MY ORDERS

async function showOrders(){

  const mobile =
  localStorage.getItem("customerMobile");

  const res =
  await fetch("/customer-orders/" + mobile);

  const orders =
  await res.json();

  if(orders.length === 0){

    alert("No current orders");

    return;

  }

  let text = "";

  orders.forEach((order,index) => {

    text +=
    `🍽️ Order ${index + 1}\n\n`;

    order.items.forEach(item => {

      text +=
      `${item.name} x${item.quantity}\n`;

    });

    text +=
    `\n🚚 Your food is on the way.\n`;

    text +=
    `📞 For more queries call:\n`;

    text +=
    `+91 9663729867\n\n`;

    text +=
    `━━━━━━━━━━━━━━\n\n`;

  });

  alert(text);

}

// START

loadFoods();

displayCart();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}