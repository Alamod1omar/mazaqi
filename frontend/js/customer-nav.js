function initCustomerNav() {
    const topNav = document.getElementById('top-nav');
    const bottomNav = document.getElementById('bottom-nav');
    if (!topNav || !bottomNav) return;

    const currentPath = window.location.pathname;
    const links = [
        { name: 'الرئيسية', icon: 'home', href: 'index.html' },
        { name: 'المنيو', icon: 'menu_book', href: 'menu.html' },
        { name: 'المفضلة', icon: 'favorite', href: 'favorites.html' },
        { name: 'طلباتي', icon: 'receipt_long', href: 'orders.html' }
    ];

    // Top Nav
    topNav.innerHTML = `
        <div class="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
            <div class="flex items-center gap-8">
                <a href="index.html" class="text-2xl font-bold text-orange-600">بوفية مذاقي</a>
                <ul class="hidden md:flex gap-6 font-sans text-base">
                    ${links.slice(0,4).map(link => {
                        const isActive = currentPath.includes(link.href) || (currentPath === '/' && link.href === 'index.html');
                        return `<li><a class="${isActive ? 'text-orange-600 border-b-2 border-orange-600 font-bold' : 'text-gray-600 hover:text-orange-500'} transition-all" href="${link.href}">${link.name}</a></li>`;
                    }).join('')}
                </ul>
            </div>
            <div class="flex items-center gap-4">
                <!-- Notification Bell -->
                <div class="relative" id="notification-wrapper">
                    <button id="notification-btn" onclick="toggleNotifications()" class="relative text-gray-600 hover:text-orange-500 transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-orange-50">
                        <span class="material-symbols-outlined">notifications</span>
                        <span id="notif-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 font-bold"></span>
                    </button>
                    <!-- Notification Dropdown -->
                    <div id="notification-dropdown" class="hidden absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden" style="min-width:320px;">
                        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                            <button onclick="markAllRead()" class="text-xs text-orange-500 font-bold hover:text-orange-700">قراءة الكل</button>
                            <h4 class="font-black text-gray-800 text-sm">الإشعارات</h4>
                        </div>
                        <div id="notification-list" class="max-h-80 overflow-y-auto">
                            <div class="flex flex-col items-center justify-center py-10 text-gray-300 gap-2">
                                <span class="material-symbols-outlined text-4xl">notifications_off</span>
                                <p class="text-sm font-bold">لا توجد إشعارات</p>
                            </div>
                        </div>
                        <div class="border-t border-gray-50 p-3">
                            <a href="notifications.html" class="block text-center text-xs font-bold text-primary hover:text-primary-container py-2 rounded-xl hover:bg-orange-50 transition-colors">عرض كل الإشعارات</a>
                        </div>
                    </div>
                </div>

                <a href="cart.html" class="text-gray-600 hover:text-orange-500 transition-colors relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-orange-50">
                    <span class="material-symbols-outlined">shopping_cart</span>
                    <span id="cart-count-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center">0</span>
                </a>
                <a href="profile.html" class="text-gray-600 hover:text-orange-500 transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-orange-50">
                    <span class="material-symbols-outlined ${currentPath.includes('profile.html') ? 'text-orange-600' : ''}">person</span>
                </a>
            </div>
        </div>
    `;

    // Bottom Nav (Mobile)
    bottomNav.innerHTML = links.map(link => {
        const isActive = currentPath.includes(link.href) || (currentPath === '/' && link.href === 'index.html');
        return `
            <a class="flex flex-col items-center justify-center ${isActive ? 'text-orange-600 bg-orange-50' : 'text-gray-400'} rounded-xl px-3 py-1 transition-all" href="${link.href}">
                <span class="material-symbols-outlined mb-1" style="${isActive ? "font-variation-settings: 'FILL' 1;" : ''}">${link.icon}</span>
                <span class="text-[10px] font-bold">${link.name}</span>
            </a>
        `;
    }).join('');

    updateCartBadge();

    // Load notifications if logged in
    const token = localStorage.getItem('mazaki_token');
    if (token) {
        loadNotifications();
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('notification-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            const dropdown = document.getElementById('notification-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
        }
    });
}

function updateCartBadge() {
    const key = typeof getCartKey === 'function' ? getCartKey() : 'mazaki_cart_guest';
    const cart = JSON.parse(localStorage.getItem(key)) || [];
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count-badge');
    if (badge) badge.innerText = count;
}

function formatTimeAgo(dateStr) {
    const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'الآن';
    const mins = Math.floor(diff / 60);
    if (mins < 60) {
        if (mins === 1) return 'منذ دقيقة';
        if (mins === 2) return 'منذ دقيقتين';
        if (mins <= 10) return `منذ ${mins} دقائق`;
        return `منذ ${mins} دقيقة`;
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
        if (hours === 1) return 'منذ ساعة';
        if (hours === 2) return 'منذ ساعتين';
        if (hours <= 10) return `منذ ${hours} ساعات`;
        return `منذ ${hours} ساعة`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        if (days === 1) return 'منذ يوم';
        if (days === 2) return 'منذ يومين';
        return `منذ ${days} أيام`;
    }
    return d.toLocaleDateString('ar-SA');
}

async function loadNotifications() {
    const token = localStorage.getItem('mazaki_token');
    if (!token) return;

    try {
        const res = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const notifications = await res.json();
        const unread = notifications.filter(n => !n.is_read).length;

        // Update badge
        const badge = document.getElementById('notif-badge');
        if (badge) {
            if (unread > 0) {
                badge.innerText = unread > 9 ? '9+' : unread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Render notifications
        const list = document.getElementById('notification-list');
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-gray-300 gap-2">
                    <span class="material-symbols-outlined text-4xl">notifications_off</span>
                    <p class="text-sm font-bold">لا توجد إشعارات</p>
                </div>`;
            return;
        }

        list.innerHTML = notifications.map(n => `
            <a href="notifications.html" onclick="markRead(${n.id})"
                class="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-all border-b border-gray-50 ${n.is_read ? 'opacity-60' : ''} cursor-pointer">
                <div class="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-orange-500 text-sm">local_offer</span>
                </div>
                <div class="flex-1 text-right min-w-0">
                    <p class="font-black text-gray-800 text-xs mb-1 truncate">${n.title}</p>
                    <p class="text-gray-500 text-xs leading-relaxed line-clamp-2">${n.message || ''}</p>
                    <p class="text-gray-300 text-[10px] mt-1">${formatTimeAgo(n.created_at)}</p>
                </div>
                ${!n.is_read ? '<div class="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-2"></div>' : ''}
            </a>
        `).join('');
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

window.toggleNotifications = function() {
    if (window.innerWidth < 768) {
        window.location.href = 'notifications.html';
        return;
    }
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
}

window.markRead = async function(id) {
    const token = localStorage.getItem('mazaki_token');
    if (!token) return;
    try {
        await fetch(`/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
    } catch (err) { console.error(err); }
}

window.markAllRead = async function() {
    const token = localStorage.getItem('mazaki_token');
    if (!token) return;
    try {
        await fetch('/api/notifications/read-all', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
    } catch (err) { console.error(err); }
}

document.addEventListener('DOMContentLoaded', initCustomerNav);
window.addEventListener('storage', updateCartBadge);
