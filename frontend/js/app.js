// Global App Logic for Mazaki Cafeteria

// First-time visit redirect & Migration
(function() {
    const isFirstTime = !localStorage.getItem('mazaki_visited');
    const path = window.location.pathname;
    const isExcludedPage = path.includes('welcome.html') || path.includes('login.html') || path.includes('register.html') || path.includes('admin/');
    
    if (isFirstTime && !isExcludedPage) {
        window.location.href = 'welcome.html';
    }

    // Migrate old cart to guest cart if needed
    const oldCart = localStorage.getItem('mazaki_cart');
    if (oldCart) {
        if (!localStorage.getItem('mazaki_cart_guest')) {
            localStorage.setItem('mazaki_cart_guest', oldCart);
        }
        localStorage.removeItem('mazaki_cart');
    }
})();

// Cart Logic
function getCartKey() {
    const user = JSON.parse(localStorage.getItem('mazaki_user'));
    return user ? `mazaki_cart_${user.id}` : 'mazaki_cart_guest';
}

let cart = JSON.parse(localStorage.getItem(getCartKey())) || [];

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countElements = document.querySelectorAll('#cart-count, #cart-count-desktop, .cart-count, #cart-count-badge');
    countElements.forEach(el => {
        el.innerText = totalItems;
    });
}

function addToCart(productId, name, price, imageUrl, quantity = 1, notes = '') {
    // Ensure we use the latest price if passed from a button that already calculated it
    const finalPrice = parseFloat(price);
    const existingItem = cart.find(item => item.product_id === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            product_id: productId,
            name: name,
            price: finalPrice,
            image_url: imageUrl,
            quantity: quantity,
            notes: notes
        });
    }
    saveCart();
    updateCartCount();
    showToast('تمت الإضافة للسلة');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product_id !== productId);
    saveCart();
    updateCartCount();
    if (typeof loadCartItems === 'function') loadCartItems();
}

function updateQuantity(productId, quantity) {
    const item = cart.find(item => item.product_id === productId);
    if (item) {
        item.quantity = Math.max(1, quantity);
        saveCart();
        updateCartCount();
        if (typeof loadCartItems === 'function') loadCartItems();
    }
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartCount();
}

function saveCart() {
    localStorage.setItem(getCartKey(), JSON.stringify(cart));
}

// Favorite Logic
let favorites = JSON.parse(localStorage.getItem('mazaki_favorites')) || [];

async function syncFavorites() {
    if (!isLoggedIn()) return;
    try {
        const res = await fetch('/api/favorites', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('mazaki_token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            favorites = data.map(p => p.id);
            localStorage.setItem('mazaki_favorites', JSON.stringify(favorites));
            refreshFavoriteIcons();
        }
    } catch (err) { console.error('Error syncing favorites:', err); }
}

function refreshFavoriteIcons() {
    document.querySelectorAll('[data-fav-id]').forEach(btn => {
        const id = parseInt(btn.getAttribute('data-fav-id'));
        const icon = btn.querySelector('.material-symbols-outlined');
        const isFav = favorites.includes(id);
        if (icon) {
            icon.innerText = isFav ? 'favorite' : 'favorite_border';
            icon.style.color = isFav ? '#ba1a1a' : '';
            icon.style.fontVariationSettings = isFav ? "'FILL' 1" : "'FILL' 0";
        }
    });
}

async function toggleFavorite(productId) {
    const id = parseInt(productId);
    const index = favorites.indexOf(id);
    const isAdding = index === -1;

    // Optimistic UI update
    if (isAdding) favorites.push(id);
    else favorites.splice(index, 1);
    
    localStorage.setItem('mazaki_favorites', JSON.stringify(favorites));
    
    // Update icons in UI immediately
    document.querySelectorAll(`[data-fav-id="${id}"]`).forEach(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        const isFav = favorites.includes(id);
        icon.innerText = isFav ? 'favorite' : 'favorite_border';
        icon.style.color = isFav ? '#ba1a1a' : '';
        icon.style.fontVariationSettings = isFav ? "'FILL' 1" : "'FILL' 0";
    });

    showToast(isAdding ? 'تمت الإضافة للمفضلة' : 'تمت الإزالة من المفضلة');

    if (isLoggedIn()) {
        try {
            if (isAdding) {
                const res = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('mazaki_token')}`
                    },
                    body: JSON.stringify({ product_id: id })
                });
                if (!res.ok) throw new Error('Failed to add');
            } else {
                const res = await fetch(`/api/favorites/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('mazaki_token')}` }
                });
                if (!res.ok) throw new Error('Failed to remove');
            }
        } catch (err) { 
            console.error('Error updating favorites on server:', err);
            // Revert on error if needed, but for now we trust local
        }
    }
}

function isFavorite(productId) {
    return favorites.includes(parseInt(productId));
}

function calculateSubtotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Auth Helpers
function isLoggedIn() {
    return !!localStorage.getItem('mazaki_token');
}

function isAdmin() {
    // Separate admin token for security as requested
    return !!localStorage.getItem('mazaki_admin_token');
}

function logout() {
    localStorage.removeItem('mazaki_token');
    localStorage.removeItem('mazaki_user');
    window.location.href = 'login.html';
}

function adminLogout() {
    localStorage.removeItem('mazaki_admin_token');
    localStorage.removeItem('mazaki_admin_user');
    window.location.href = 'login.html';
}

// UI Helpers
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-3 rounded-full shadow-lg z-[100] font-bold animate-bounce';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Offers Logic
let activeOffers = [];

async function fetchActiveOffers() {
    try {
        const res = await fetch('/api/offers');
        const allOffers = await res.json();
        const now = new Date();
        activeOffers = allOffers.filter(o => {
            const isProductOffer = !!o.product_id;
            const notExpired = !o.end_date || new Date(o.end_date) > now;
            return o.is_active && isProductOffer && notExpired;
        });
        return activeOffers;
    } catch (err) {
        console.error('Error fetching offers:', err);
        return [];
    }
}

function getProductDiscount(productId) {
    return activeOffers.find(o => o.product_id == productId);
}

function calculateDiscountedPrice(originalPrice, discountPercent) {
    return originalPrice - (originalPrice * (discountPercent / 100));
}

// Initial Run
updateCartCount();
fetchActiveOffers();
syncFavorites();
