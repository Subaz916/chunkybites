// js/data.js

const DATA_VERSION = 'v2'; // bump this to force menu refresh

const StorageKeys = {
    USERS: 'chunky_bites_users',
    CURRENT_USER: 'chunky_bites_currentUser',
    MENU: 'chunky_bites_menu',
    ORDERS: 'chunky_bites_orders',
    VERSION: 'chunky_bites_version'
};

const DefaultMenu = [
    {
        id: 'm1',
        name: 'Cyber Burger',
        desc: 'Double beef patty with neon cheese and glitch sauce.',
        category: 'Burger',
        price: 12.99,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1899&auto=format&fit=crop',
        status: 'active'
    },
    {
        id: 'm2',
        name: 'Neon Pizza',
        desc: 'Pepperoni with glowing mozzarella and spicy oil.',
        category: 'Pizza',
        price: 18.50,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1981&auto=format&fit=crop',
        status: 'active'
    },
    {
        id: 'm3',
        name: 'Crispy Broast',
        desc: 'Futuristically fried chicken, crunchy and juicy.',
        category: 'Broast',
        price: 15.00,
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFvBr4uvoWhizJMSDxEB-IX7xsIPz-WIgW5w&s',
        status: 'active'
    },
    {
        id: 'm4',
        name: 'Plasma Cola',
        desc: 'Electrifying signature drink.',
        category: 'Drinks',
        price: 3.50,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=2070&auto=format&fit=crop',
        status: 'active'
    }
];

// Initialize Data
function initializeData() {
    // Force menu refresh when DATA_VERSION changes
    if (localStorage.getItem(StorageKeys.VERSION) !== DATA_VERSION) {
        localStorage.setItem(StorageKeys.MENU, JSON.stringify(DefaultMenu));
        localStorage.setItem(StorageKeys.VERSION, DATA_VERSION);
    }
    if (!localStorage.getItem(StorageKeys.MENU)) {
        localStorage.setItem(StorageKeys.MENU, JSON.stringify(DefaultMenu));
    }
    if (!localStorage.getItem(StorageKeys.USERS)) {
        // Create default admin
        const adminUser = {
            id: 'u1',
            name: 'System Admin',
            email: 'admin@chunky.com',
            password: 'admin', // Very basic auth simulation
            role: 'admin'
        };
        localStorage.setItem(StorageKeys.USERS, JSON.stringify([adminUser]));
    }
    if (!localStorage.getItem(StorageKeys.ORDERS)) {
        localStorage.setItem(StorageKeys.ORDERS, JSON.stringify([]));
    }
}

// Data Utility Functions
const DataBase = {
    getMenu: () => JSON.parse(localStorage.getItem(StorageKeys.MENU) || '[]'),
    saveMenu: (menu) => localStorage.setItem(StorageKeys.MENU, JSON.stringify(menu)),
    
    getUsers: () => JSON.parse(localStorage.getItem(StorageKeys.USERS) || '[]'),
    saveUsers: (users) => localStorage.setItem(StorageKeys.USERS, JSON.stringify(users)),
    
    getOrders: () => JSON.parse(localStorage.getItem(StorageKeys.ORDERS) || '[]'),
    saveOrders: (orders) => localStorage.setItem(StorageKeys.ORDERS, JSON.stringify(orders)),
    
    getCurrentUser: () => JSON.parse(localStorage.getItem(StorageKeys.CURRENT_USER)),
    setCurrentUser: (user) => localStorage.setItem(StorageKeys.CURRENT_USER, JSON.stringify(user)),
    logout: () => localStorage.removeItem(StorageKeys.CURRENT_USER)
};

// Run initialization on load
initializeData();
