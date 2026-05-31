// js/admin.js

window.admin = {
    init() {
        const user = DataBase.getCurrentUser();
        if (!user || user.role !== 'admin') {
            app.navigate('home');
            return;
        }
        this.renderMenuTable();
        this.renderOrdersTable();
    },

    showTab(tabId) {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        document.getElementById(tabId).classList.add('active-tab');
        
        if (tabId === 'admin-menu') this.renderMenuTable();
        if (tabId === 'admin-orders') this.renderOrdersTable();
    },

    // --- Manage Menu ---

    renderMenuTable() {
        const menu = DataBase.getMenu();
        const tbody = document.getElementById('admin-menu-table');
        if (!tbody) return;

        tbody.innerHTML = menu.map(item => `
            <tr>
                <td><img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/50?text=No+Img'"></td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>$${parseFloat(item.price).toFixed(2)}</td>
                <td><span class="status-badge ${item.status === 'active' ? 'status-delivered' : 'status-pending'}">${item.status}</span></td>
                <td>
                    <button class="action-btn edit" onclick="admin.editItem('${item.id}')">✏️ Edit</button>
                    <button class="action-btn delete" onclick="admin.deleteItem('${item.id}')">🗑️ Delete</button>
                </td>
            </tr>
        `).join('');
    },

    openItemModal() {
        document.getElementById('item-form').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('modal-title').textContent = 'Add Menu Item';
        document.getElementById('item-modal').style.display = 'block';
    },

    closeItemModal() {
        document.getElementById('item-modal').style.display = 'none';
    },

    saveItem(e) {
        e.preventDefault();
        const idInput = document.getElementById('item-id').value;
        const menu = DataBase.getMenu();

        const itemData = {
            id: idInput || 'm' + Date.now(),
            name: document.getElementById('item-name').value,
            desc: document.getElementById('item-desc').value,
            category: document.getElementById('item-category').value,
            price: parseFloat(document.getElementById('item-price').value),
            image: document.getElementById('item-image').value,
            status: document.getElementById('item-status').value
        };

        if (idInput) {
            // Update
            const index = menu.findIndex(i => i.id === idInput);
            if (index !== -1) {
                menu[index] = itemData;
            }
        } else {
            // Add new
            menu.push(itemData);
        }

        DataBase.saveMenu(menu);
        this.closeItemModal();
        this.renderMenuTable();
        app.renderMenu(); // Update user facing menu too if they go back
    },

    editItem(id) {
        const menu = DataBase.getMenu();
        const item = menu.find(i => i.id === id);
        if (!item) return;

        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-desc').value = item.desc;
        document.getElementById('item-category').value = item.category;
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-image').value = item.image;
        document.getElementById('item-status').value = item.status;

        document.getElementById('modal-title').textContent = 'Edit Menu Item';
        document.getElementById('item-modal').style.display = 'block';
    },

    deleteItem(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            let menu = DataBase.getMenu();
            menu = menu.filter(i => i.id !== id);
            DataBase.saveMenu(menu);
            this.renderMenuTable();
            app.renderMenu();
        }
    },

    // --- Manage Orders ---

    renderOrdersTable() {
        const orders = DataBase.getOrders();
        const tbody = document.getElementById('admin-orders-table');
        if (!tbody) return;

        // Sort newest first
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.id}</td>
                <td>
                    ${order.customerName}<br>
                    <small class="text-muted">${order.userEmail}</small>
                </td>
                <td>${order.items.length} items</td>
                <td>$${order.total}</td>
                <td>
                    <select onchange="admin.updateOrderStatus('${order.id}', this.value)" class="status-badge status-${order.status.toLowerCase()}">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        <option value="Out of Stock" ${order.status === 'Out of Stock' ? 'selected' : ''}>Out of Stock</option>
                        <option value="EID Out of Stock" ${order.status === 'EID Out of Stock' ? 'selected' : ''}>EID Out of Stock</option>
                    </select>
                </td>
                <td>
                    <button class="action-btn" onclick="admin.viewOrderDetails('${order.id}')">👁️ View</button>
                </td>
            </tr>
        `).join('');
    },

    updateOrderStatus(id, newStatus) {
        const orders = DataBase.getOrders();
        const index = orders.findIndex(o => o.id === id);
        if (index !== -1) {
            orders[index].status = newStatus;
            DataBase.saveOrders(orders);
            // Re-render to update the select box styling
            this.renderOrdersTable();
        }
    },

    viewOrderDetails(id) {
        const orders = DataBase.getOrders();
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const itemsList = order.items.map(i => `${i.qty}x ${i.name} ($${i.price})`).join('\n');
        alert(`Order ID: ${order.id}
Customer: ${order.customerName}
Phone: ${order.phone}
Address: ${order.address}
Date: ${new Date(order.date).toLocaleString()}

Items:
${itemsList}

Total: $${order.total}
Status: ${order.status}`);
    }
};

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('item-modal');
    if (event.target === modal) {
        admin.closeItemModal();
    }
};
