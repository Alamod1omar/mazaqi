function initAdminSidebar() {
    const nav = document.getElementById('admin-nav');
    if (!nav) return;

    // Create backdrop if not exists
    if (!document.getElementById('sidebar-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 z-[998] hidden transition-opacity duration-300';
        backdrop.onclick = toggleAdminSidebar;
        document.body.appendChild(backdrop);
    }

    const currentPath = window.location.pathname.toLowerCase();
    const links = [
        { name: 'لوحة التحكم', icon: 'dashboard', href: 'dashboard.html' },
        { name: 'الطلبات', icon: 'receipt_long', href: 'orders.html' },
        { name: 'الأرشيف', icon: 'archive', href: 'archive.html' },
        { name: 'المنتجات', icon: 'restaurant_menu', href: 'products.html' },
        { name: 'التصنيفات', icon: 'category', href: 'categories.html' },
        { name: 'العروض', icon: 'local_offer', href: 'offers.html' },
        { name: 'العملاء', icon: 'group', href: 'users.html' },
        { name: 'مناطق التوصيل', icon: 'local_shipping', href: 'delivery-zones.html' },
        { name: 'الإعدادات', icon: 'settings', href: 'settings.html' }
    ];

    const header = `
        <div class="flex items-center justify-between px-6 py-5 md:hidden border-b border-gray-100 bg-white">
            <div>
                <span class="font-black text-gray-900 text-lg block">بوفية مذاقي</span>
                <span class="text-[10px] text-gray-400 font-bold">القائمة الرئيسية</span>
            </div>
            <button onclick="toggleAdminSidebar()" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `;

    nav.innerHTML = header + links.map(link => {
        const isActive = currentPath.includes(link.href.toLowerCase()) ||
            (currentPath.endsWith('/admin/') && link.href === 'dashboard.html');

        const activeClass = isActive ?
            'bg-orange-50 text-orange-700 border-r-4 border-orange-600' :
            'text-gray-500 hover:bg-gray-100 border-r-4 border-transparent';

        return `
            <a class="${activeClass} flex items-center px-6 py-3 transition-colors duration-200 gap-4" href="${link.href}">
                <span class="material-symbols-outlined text-orange-600">${link.icon}</span>
                <span class="font-bold">${link.name}</span>
            </a>
        `;
    }).join('') + `
        <button onclick="adminLogout()" class="mt-auto text-red-500 hover:bg-red-50 flex items-center px-6 py-3 transition-colors duration-200 gap-4 border-r-4 border-transparent">
            <span class="material-symbols-outlined">logout</span>
            <span class="font-bold">تسجيل الخروج</span>
        </button>
    `;
}

function toggleAdminSidebar() {
    const sidebar = document.querySelector('aside');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const isHidden = sidebar.classList.contains('hidden') || sidebar.classList.contains('translate-x-full');

    if (isHidden) {
        // OPEN sidebar
        sidebar.classList.remove('hidden', 'translate-x-full');
        sidebar.style.cssText = 'display:flex !important; position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; z-index:999 !important; width:280px !important; flex-direction:column !important; background:white !important; box-shadow: -5px 0 25px rgba(0,0,0,0.15) !important;';
        backdrop.classList.remove('hidden');
        backdrop.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        // CLOSE sidebar
        sidebar.style.cssText = '';
        sidebar.classList.add('hidden');
        sidebar.classList.add('md:flex');
        backdrop.classList.add('hidden');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function adminLogout() {
    localStorage.removeItem('mazaki_admin_token');
    window.location.href = 'login.html';
}

// Global scope
window.toggleAdminSidebar = toggleAdminSidebar;
window.adminLogout = adminLogout;

// Add Animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-in-right {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
    .animate-slide-in-right {
        animation: slide-in-right 0.3s ease-out forwards;
    }
    
    /* Force mobile table responsiveness */
    @media (max-width: 768px) {
        .overflow-x-auto {
            -webkit-overflow-scrolling: touch;
        }
        table th, table td {
            padding-left: 8px !important;
            padding-right: 8px !important;
            font-size: 12px !important;
        }
    }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminSidebar);
} else {
    initAdminSidebar();
}
