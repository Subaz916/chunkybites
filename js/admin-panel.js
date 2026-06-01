// js/admin-panel.js — CHUNKY BITES Full Admin Logic

const panel = {
    user: null,
    orders: [],
    menuItems: [],
    categories: [],
    users: [],
    _printedOrders: new Set(),
    _currentOrderId: null,


    // ================================================
    // INIT & AUTH
    // ================================================

    async init() {
        try {
            const res = await API.get('/auth/me');
            if (!res.user || res.user.role !== 'admin') {
                this._showLogin('Please log in as admin.');
                return;
            }
            this.user = res.user;
            this._showApp();
            this.switchTab('dashboard');
        } catch (err) {
            this._showLogin(err.message);
        }
    },

    _showLogin(msg) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-app').style.display = 'none';
        if (msg) {
            const el = document.getElementById('login-error');
            el.textContent = msg;
            el.style.display = 'block';
        }
    },

    _showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-app').style.display = 'flex';
        const initials = this.user.name ? this.user.name.charAt(0).toUpperCase() : 'A';
        document.getElementById('sidebar-avatar').textContent = initials;
        document.getElementById('sidebar-name').textContent  = this.user.name;
        document.getElementById('topbar-user').textContent   = '👤 ' + this.user.name;
        document.getElementById('info-email').textContent    = this.user.email;
    },

    async login(e) {
        e.preventDefault();
        const btn   = document.getElementById('login-btn');
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        btn.textContent = 'Logging in…';
        btn.disabled = true;

        try {
            const res = await API.post('/auth/login', {
                email:    document.getElementById('login-email').value,
                password: document.getElementById('login-password').value,
            });
            if (res.user.role !== 'admin') throw new Error('You do not have admin privileges.');
            this.user = res.user;
            this._showApp();
            this.switchTab('dashboard');
        } catch (err) {
            errEl.textContent   = err.message;
            errEl.style.display = 'block';
        } finally {
            btn.textContent = 'Login to Admin';
            btn.disabled = false;
        }
    },

    async logout() {
        await API.post('/auth/logout').catch(() => {});
        this._showLogin();
    },

    // ================================================
    // TAB SWITCHING
    // ================================================

    switchTab(tabId) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));

        const tab = document.getElementById(`tab-${tabId}`);
        if (tab) tab.classList.add('active');

        const navEl = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
        if (navEl) navEl.classList.add('active');

        const titles = {
            dashboard:  'Dashboard',
            orders:     'Manage Orders',
            menu:       'Menu Items',
            categories: 'Categories',
            users:      'User Management',
            settings:   'Settings',
        };
        document.getElementById('page-title').textContent = titles[tabId] || tabId;

        const loaders = {
            dashboard:  () => this.loadDashboard(),
            orders:     () => this.loadOrders(),
            menu:       () => this.loadMenu(),
            categories: () => this.loadCategories(),
            users:      () => this.loadUsers(),
            settings:   () => this.loadSettings(),
        };
        if (loaders[tabId]) loaders[tabId]();
    },

    // ================================================
    // DASHBOARD
    // ================================================

    async loadDashboard() {
        try {
            const s = await API.get('/stats');

            document.getElementById('s-orders').textContent  = s.total_orders;
            document.getElementById('s-revenue').textContent = 'PKR ' + s.total_revenue.toFixed(2);
            document.getElementById('s-users').textContent   = s.total_users;
            document.getElementById('s-items').textContent   = s.total_items;

            // pending badge
            const badge = document.getElementById('pending-badge');
            if (s.pending > 0) { badge.textContent = s.pending; badge.style.display = 'inline'; }
            else badge.style.display = 'none';

            // Status grid
            document.getElementById('status-grid').innerHTML = `
                <div class="status-box s-pending">
                    <div class="s-count">${s.pending}</div>
                    <div class="s-label">Pending</div>
                </div>
                <div class="status-box s-preparing">
                    <div class="s-count">${s.preparing}</div>
                    <div class="s-label">Preparing</div>
                </div>
                <div class="status-box s-out">
                    <div class="s-count">${s.out_for_delivery}</div>
                    <div class="s-label">Out for Delivery</div>
                </div>
                <div class="status-box s-delivered">
                    <div class="s-count">${s.delivered}</div>
                    <div class="s-label">Delivered</div>
                </div>
                <div class="status-box s-cancelled">
                    <div class="s-count">${s.cancelled}</div>
                    <div class="s-label">Cancelled</div>
                </div>
                <div class="status-box s-out-of-stock">
                    <div class="s-count">${s.out_of_stock}</div>
                    <div class="s-label">Out of Stock</div>
                </div>
                <div class="status-box s-eid-out-of-stock" style="grid-column:1/-1">
                    <div class="s-count">${s.eid_out_of_stock}</div>
                    <div class="s-label">EID Out of Stock</div>
                </div>
            `;

            // Recent orders
            const el = document.getElementById('recent-orders-list');
            if (!s.recent_orders.length) {
                el.innerHTML = '<p style="padding:1.5rem;text-align:center;color:var(--muted)">No orders yet.</p>';
            } else {
                el.innerHTML = s.recent_orders.map(o => `
                    <div class="recent-item">
                        <span class="recent-id">${o.id}</span>
                        <span>${o.customer_name || '—'}</span>
                        <span class="recent-total">PKR ${parseFloat(o.total).toFixed(2)}</span>
                        <span class="badge ${this._statusBadge(o.status)}">${o.status}</span>
                    </div>
                `).join('');
            }
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // ================================================
    // ORDERS
    // ================================================

    async loadOrders() {
        try {
            this.orders = await API.get('/orders');
            // Load printed orders from localStorage
            this._printedOrders = new Set(JSON.parse(localStorage.getItem('printedOrders') || '[]'));
            this.renderOrdersTable();
        } catch (err) { this.toast(err.message, 'error'); }
    },

        renderOrdersTable() {
            const filter = document.getElementById('orders-status-filter').value;
            let list = this.orders;
            if (filter) list = list.filter(o => o.status === filter);

            const tbody = document.getElementById('orders-tbody');
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No orders found.</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(o => {
                const statusClass = o.status.toLowerCase().replace(/\s+/g, '-');
                const isPrinted = this._printedOrders && this._printedOrders.has(o.id);
                return `<tr>
                    <td><strong style="font-family:monospace;font-size:.78rem">${o.id}</strong></td>
                    <td>
                        ${o.customer_name || '—'}
                        <small class="sub">${o.user_email || ''}</small>
                    </td>
                    <td>${(o.items || []).length} item${(o.items || []).length !== 1 ? 's' : ''}</td>
                    <td><strong>PKR ${parseFloat(o.total).toFixed(2)}</strong></td>
                    <td><small class="text-muted">${this._fmtDate(o.date)}</small></td>
                    <td>
                        <select class="status-sel s-${statusClass}" onchange="panel.updateOrderStatus('${o.id}', this)">
                            ${['Pending','Preparing','Out for Delivery','Delivered','Cancelled','Out of Stock','EID Out of Stock']
                                .map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                    </td>
                    <td style="white-space:nowrap">
                        <button class="act-btn view"  onclick="panel.openOrderModal('${o.id}')">👁️ View</button>
                        <button class="act-btn print" onclick="panel.printSlip('${o.id}')">🖨️ Slip</button>
                        ${isPrinted ? '' : `<button class="act-btn del"   onclick="panel.deleteOrder('${o.id}')">🗑️</button>`}
                    </td>
                </tr>`;
            }).join('');
        },

    async updateOrderStatus(id, selectEl) {
        const status = selectEl.value;
        try {
            await API.put(`/orders/${id}`, { status });
            const o = this.orders.find(x => x.id === id);
            if (o) o.status = status;
            // Update select class
            selectEl.className = `status-sel s-${status.toLowerCase().replace(/\s+/g, '-')}`;
            this.toast(`Order ${id} → ${status}`, 'success');
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    openOrderModal(id) {
        const o = this.orders.find(x => x.id === id);
        if (!o) return;
        this._currentOrderId = id;

        const rows = (o.items || []).map(i => `
            <tr>
                <td>${i.qty}×</td>
                <td>${i.item_name}</td>
                <td>PKR ${parseFloat(i.price).toFixed(2)}</td>
                <td><strong>PKR ${(parseFloat(i.price) * i.qty).toFixed(2)}</strong></td>
            </tr>
        `).join('');

        document.getElementById('order-modal-title').textContent = `Order ${o.id}`;
        document.getElementById('order-detail-body').innerHTML = `
            <div class="od-grid">
                <div class="od-section">
                    <h4>Customer Info</h4>
                    <p><strong>Name:</strong> ${o.customer_name || '—'}</p>
                    <p><strong>Email:</strong> ${o.user_email || '—'}</p>
                    <p><strong>Phone:</strong> ${o.phone || '—'}</p>
                    <p><strong>Address:</strong> ${o.address || '—'}</p>
                    ${o.notes ? `<p><strong>Notes:</strong> ${o.notes}</p>` : ''}
                </div>
                <div class="od-section">
                    <h4>Order Info</h4>
                    <p><strong>Order ID:</strong> <span style="font-family:monospace">${o.id}</span></p>
                    <p><strong>Date:</strong> ${this._fmtDate(o.date)}</p>
                    <p><strong>Status:</strong> <span class="badge ${this._statusBadge(o.status)}">${o.status}</span></p>
                </div>
            </div>
            <div class="detail-items-title">Items Ordered</div>
            <table class="data-table">
                <thead><tr><th>Qty</th><th>Item</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr><td colspan="3" style="text-align:right;padding:.6rem 1rem;color:var(--muted)">Subtotal</td><td style="padding:.6rem 1rem">PKR ${parseFloat(o.subtotal).toFixed(2)}</td></tr>
                    <tr><td colspan="3" style="text-align:right;padding:.4rem 1rem;color:var(--muted)">Tax</td><td style="padding:.4rem 1rem">PKR ${parseFloat(o.tax).toFixed(2)}</td></tr>
                    <tr><td colspan="3" style="text-align:right;padding:.6rem 1rem;font-weight:700">TOTAL</td><td style="padding:.6rem 1rem;font-weight:800;font-size:1.05rem;color:var(--accent)">PKR ${parseFloat(o.total).toFixed(2)}</td></tr>
                </tfoot>
            </table>
        `;

        document.getElementById('modal-order').classList.add('open');
    },

    closeOrderModal() {
        document.getElementById('modal-order').classList.remove('open');
    },

    printCurrentOrder() {
        if (this._currentOrderId) this.printSlip(this._currentOrderId);
    },

    printSlip(id) {
        const o = this.orders.find(x => x.id === id);
        if (!o) return;
        this._currentOrderId = id;
// Record that slip has been printed
this._printedOrders = this._printedOrders || new Set();
this._printedOrders.add(id);
localStorage.setItem('printedOrders', JSON.stringify([...this._printedOrders]));
this.renderOrdersTable();

        const itemRows = (o.items || []).map(i => `
            <div class="slip-items-row">
                <span class="slip-qty">${i.qty}×</span>
                <span class="slip-name">${i.item_name}</span>
                <span class="slip-price">PKR ${(parseFloat(i.price) * i.qty).toFixed(2)}</span>
            </div>
        `).join('');

        const dateObj = new Date(o.date);
        document.getElementById('print-slip-body').innerHTML = `
            <div class="print-slip-wrap">
                <div class="slip-head">
                    <div class="slip-brand-name">🍔 CHUNKY BITES</div>
                    <div class="slip-tagline">Premium Fast Food Experience</div>
                </div>
                <div class="slip-div">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="slip-row"><span>Order ID:</span><span style="font-weight:700">${o.id}</span></div>
                <div class="slip-row"><span>Date:</span><span>${dateObj.toLocaleDateString()}</span></div>
                <div class="slip-row"><span>Time:</span><span>${dateObj.toLocaleTimeString()}</span></div>
                <div class="slip-div">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="slip-row"><span>Customer:</span><span>${o.customer_name || '—'}</span></div>
                <div class="slip-row"><span>Phone:</span><span>${o.phone || '—'}</span></div>
                <div class="slip-row"><span>Address:</span><span style="font-size:.75rem;text-align:right;max-width:160px">${o.address || '—'}</span></div>
                <div class="slip-div">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;font-weight:700;color:var(--muted);margin-bottom:.25rem">
                    <span>QTY  ITEM</span><span>PRICE</span>
                </div>
                ${itemRows}
                <div class="slip-div" style="margin-top:.5rem">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="slip-row"><span>Subtotal:</span><span>PKR ${parseFloat(o.subtotal).toFixed(2)}</span></div>
                <div class="slip-row"><span>Tax:</span><span>PKR ${parseFloat(o.tax).toFixed(2)}</span></div>
                <div class="slip-total-line"><span>TOTAL:</span><span>PKR ${parseFloat(o.total).toFixed(2)}</span></div>
                <div class="slip-div">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="slip-status-line">Status: ${o.status.toUpperCase()}</div>
                <div class="slip-div">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="slip-footer">
                    <p>Thank you for choosing CHUNKY BITES! 🍔</p>
                    <p>Come back soon — we miss you already!</p>
                </div>
            </div>
        `;

        document.getElementById('modal-print').classList.add('open');
    },

    closePrintModal() {
        document.getElementById('modal-print').classList.remove('open');
    },

    async deleteOrder(id) {
        // Prevent deletion if the order's slip has been printed
        if (this._printedOrders && this._printedOrders.has(id)) {
            this.toast('Cannot delete order after slip printed.', 'error');
            return;
        }
        if (!confirm(`Delete order ${id}? This cannot be undone.`)) return;
        try {
            await API.delete(`/orders/${id}`);
            this.orders = this.orders.filter(o => o.id !== id);
            this.renderOrdersTable();
            this.toast('Order deleted.', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    // ================================================
    // MENU ITEMS
    // ================================================

    async loadMenu() {
        try {
            [this.menuItems, this.categories] = await Promise.all([
                API.get('/menu'),
                API.get('/categories'),
            ]);
            // Populate category filter
            const filterSel = document.getElementById('menu-cat-filter');
            filterSel.innerHTML = '<option value="">All Categories</option>' +
                this.categories.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
            this.renderMenuTable();
        } catch (err) { this.toast(err.message, 'error'); }
    },

    renderMenuTable() {
        const catFilter = document.getElementById('menu-cat-filter').value;
        let list = this.menuItems;
        if (catFilter) list = list.filter(i => i.category_name === catFilter);

        const tbody = document.getElementById('menu-tbody');
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No items found.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(item => `
            <tr>
                <td>
                    <img class="table-img" src="${item.image || ''}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                         alt="${item.name}">
                    <div style="display:none;width:46px;height:46px;background:rgba(255,255,255,.06);border-radius:8px;align-items:center;justify-content:center;font-size:1.4rem">🍽️</div>
                </td>
                <td>
                    <strong>${item.name}</strong>
                    <small class="sub">${item.desc ? item.desc.substring(0,50) + (item.desc.length > 50 ? '…' : '') : ''}</small>
                </td>
                <td>${item.category_name || '—'}</td>
                <td><strong>PKR ${parseFloat(item.price).toFixed(2)}</strong></td>
                <td><span class="badge ${item.status === 'active' ? 'badge-green' : (item.status === 'hidden' ? 'badge-gray' : 'badge-red')}">${item.status}</span></td>
                <td style="white-space:nowrap">
                    <button class="act-btn edit"   onclick="panel.editMenuItem('${item.id}')">✏️ Edit</button>
                    <button class="act-btn toggle" onclick="panel.toggleItemStatus('${item.id}', '${item.status}')">${item.status === 'hidden' ? '✅ Show' : '🚫 Hide'}</button>
                    <button class="act-btn del"    onclick="panel.deleteMenuItem('${item.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    openMenuModal(item = null) {
        document.getElementById('menu-item-form').reset();
        document.getElementById('mi-id').value = '';
        document.getElementById('menu-modal-title').textContent = item ? 'Edit Menu Item' : 'Add Menu Item';

        // Populate category dropdown
        const catSel = document.getElementById('mi-category');
        catSel.innerHTML = this.categories.map(c =>
            `<option value="${c.name}">${c.icon} ${c.name}</option>`
        ).join('');

        if (item) {
            document.getElementById('mi-id').value       = item.id;
            document.getElementById('mi-name').value     = item.name;
            document.getElementById('mi-desc').value     = item.desc || '';
            document.getElementById('mi-category').value = item.category_name || '';
            document.getElementById('mi-price').value    = item.price;
            document.getElementById('mi-image').value    = item.image || '';
            document.getElementById('mi-status').value   = item.status;
        }

        document.getElementById('modal-menu').classList.add('open');
    },

    closeMenuModal() {
        document.getElementById('modal-menu').classList.remove('open');
    },

    async saveMenuItem(e) {
        e.preventDefault();
        const id   = document.getElementById('mi-id').value;
        const data = {
            name:          document.getElementById('mi-name').value,
            desc:          document.getElementById('mi-desc').value,
            category_name: document.getElementById('mi-category').value,
            price:         document.getElementById('mi-price').value,
            image:         document.getElementById('mi-image').value,
            status:        document.getElementById('mi-status').value,
        };

        try {
            if (id) await API.put(`/menu/${id}`, data);
            else     await API.post('/menu', data);

            this.closeMenuModal();
            await this.loadMenu();
            this.toast(id ? 'Item updated!' : 'Item added!', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    editMenuItem(id) {
        const item = this.menuItems.find(i => i.id === id);
        if (item) this.openMenuModal(item);
    },

    async toggleItemStatus(id, current) {
        const item = this.menuItems.find(i => i.id === id);
        if (!item) return;
        const newStatus = current === 'hidden' ? 'active' : 'hidden';
        try {
            await API.put(`/menu/${id}`, { ...item, status: newStatus });
            await this.loadMenu();
        } catch (err) { this.toast(err.message, 'error'); }
    },

    async deleteMenuItem(id) {
        if (!confirm('Delete this menu item? This cannot be undone.')) return;
        try {
            await API.delete(`/menu/${id}`);
            await this.loadMenu();
            this.toast('Item deleted.', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    // ================================================
    // CATEGORIES
    // ================================================

    async loadCategories() {
        try {
            this.categories = await API.get('/categories');
            this.renderCategoriesTable();
        } catch (err) { this.toast(err.message, 'error'); }
    },

    renderCategoriesTable() {
        const tbody = document.getElementById('categories-tbody');
        if (!this.categories.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No categories yet.</td></tr>';
            return;
        }

        tbody.innerHTML = this.categories.map(c => `
            <tr>
                <td style="font-size:1.6rem;text-align:center">${c.icon}</td>
                <td><strong>${c.name}</strong></td>
                <td><span class="badge badge-gray">#${c.sort_order}</span></td>
                <td style="white-space:nowrap">
                    <button class="act-btn edit" onclick="panel.editCategory('${c.id}')">✏️ Edit</button>
                    <button class="act-btn del"  onclick="panel.deleteCategory('${c.id}')">🗑️ Delete</button>
                </td>
            </tr>
        `).join('');
    },

    openCatModal(cat = null) {
        document.getElementById('cat-form').reset();
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-modal-title').textContent = cat ? 'Edit Category' : 'Add Category';

        if (cat) {
            document.getElementById('cat-id').value   = cat.id;
            document.getElementById('cat-icon').value = cat.icon;
            document.getElementById('cat-name').value = cat.name;
        }

        document.getElementById('modal-cat').classList.add('open');
    },

    closeCatModal() {
        document.getElementById('modal-cat').classList.remove('open');
    },

    async saveCategory(e) {
        e.preventDefault();
        const id   = document.getElementById('cat-id').value;
        const data = {
            name: document.getElementById('cat-name').value,
            icon: document.getElementById('cat-icon').value || '🍽️',
        };

        try {
            if (id) await API.put(`/categories/${id}`, data);
            else     await API.post('/categories', data);

            this.closeCatModal();
            await this.loadCategories();
            this.toast(id ? 'Category updated!' : 'Category added!', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    editCategory(id) {
        const cat = this.categories.find(c => c.id === id);
        if (cat) this.openCatModal(cat);
    },

    async deleteCategory(id) {
        if (!confirm('Delete this category? Menu items in this category will not be deleted.')) return;
        try {
            await API.delete(`/categories/${id}`);
            await this.loadCategories();
            this.toast('Category deleted.', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    // ================================================
    // USERS
    // ================================================

    async loadUsers() {
        try {
            this.users = await API.get('/users');
            this.renderUsersTable();
        } catch (err) { this.toast(err.message, 'error'); }
    },

    renderUsersTable() {
        const tbody = document.getElementById('users-tbody');
        if (!this.users.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = this.users.map(u => `
            <tr class="${!u.is_active ? 'row-inactive' : ''}">
                <td><strong>${u.name}</strong></td>
                <td style="font-size:.82rem">${u.email}</td>
                <td style="font-size:.82rem">${u.phone || '—'}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}">${u.role}</span></td>
                <td style="text-align:center">${u.order_count}</td>
                <td><strong>PKR ${parseFloat(u.total_spent || 0).toFixed(2)}</strong></td>
                <td><small class="text-muted">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</small></td>
                <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Terminated'}</span></td>
                <td style="white-space:nowrap">
                    ${u.role !== 'admin' ? `
                        <button class="act-btn ${u.is_active ? 'del' : 'restore'}"
                                onclick="panel.toggleUser('${u.id}', ${u.is_active})">
                            ${u.is_active ? '🚫 Terminate' : '✅ Activate'}
                        </button>
                        <button class="act-btn del" onclick="panel.deleteUser('${u.id}')">🗑️ Delete</button>
                    ` : '<span class="text-muted" style="font-size:.8rem">Protected</span>'}
                </td>
            </tr>
        `).join('');
    },

    async toggleUser(id, isActive) {
        const action = isActive ? 'terminate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        try {
            await API.put(`/users/${id}`, { is_active: isActive ? 0 : 1 });
            await this.loadUsers();
            this.toast(`User ${action}d.`, 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    async deleteUser(id) {
        if (!confirm('Permanently delete this user? This removes all their data.')) return;
        try {
            await API.delete(`/users/${id}`);
            await this.loadUsers();
            this.toast('User deleted permanently.', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    // ================================================
    // SETTINGS
    // ================================================

    async changePassword(e) {
        e.preventDefault();
        const cur     = document.getElementById('pwd-current').value;
        const newPwd  = document.getElementById('pwd-new').value;
        const confirm = document.getElementById('pwd-confirm').value;

        if (newPwd.length < 6) return this.toast('Password must be at least 6 characters.', 'error');
        if (newPwd !== confirm) return this.toast('New passwords do not match.', 'error');

        try {
            await API.post('/auth/change-password', {
                current_password: cur,
                new_password:     newPwd,
            });
            document.getElementById('pwd-form').reset();
            this.toast('Password changed successfully! 🔐', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    async loadSettings() {
        try {
            const settings = await API.get('/settings');
            document.getElementById('announcement-enabled').value = settings.announcement_enabled || '1';
            document.getElementById('announcement-text').value = settings.announcement_text || '';
            if(document.getElementById('tax-rate')) document.getElementById('tax-rate').value = settings.tax_rate || '10.0';
            if(document.getElementById('delivery-enabled')) document.getElementById('delivery-enabled').value = settings.delivery_enabled || '0';
            if(document.getElementById('delivery-charge')) document.getElementById('delivery-charge').value = settings.delivery_charge || '50.0';
            // Render store control buttons
            this._renderStoreControls(settings.store_open || '1', settings.deliveries_stopped || '0');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    _renderStoreControls(storeOpen, deliveriesStopped) {
        const isOpen = storeOpen === '1';
        const isStopped = deliveriesStopped === '1';

        // Store toggle
        const storeCard = document.getElementById('store-toggle-card');
        const storeIcon = document.getElementById('store-status-icon');
        const storeLabel = document.getElementById('store-status-label');
        const storeBtnIcon = document.getElementById('store-btn-icon');
        const storeBtnLabel = document.getElementById('store-btn-label');
        const storeBtn = document.getElementById('store-toggle-btn');

        if (isOpen) {
            storeCard.className = 'sc-toggle-card store-open';
            storeIcon.textContent = '🟢';
            storeLabel.textContent = 'Store is OPEN';
            storeBtnIcon.textContent = '🔒';
            storeBtnLabel.textContent = 'Close Store';
            storeBtn.className = 'sc-big-btn store-open-btn';
        } else {
            storeCard.className = 'sc-toggle-card store-closed';
            storeIcon.textContent = '🔴';
            storeLabel.textContent = 'Store is CLOSED';
            storeBtnIcon.textContent = '🔓';
            storeBtnLabel.textContent = 'Open Store';
            storeBtn.className = 'sc-big-btn store-closed-btn';
        }

        // Delivery toggle
        const delCard = document.getElementById('delivery-toggle-card');
        const delIcon = document.getElementById('delivery-status-icon');
        const delLabel = document.getElementById('delivery-status-label');
        const delBtnIcon = document.getElementById('delivery-btn-icon');
        const delBtnLabel = document.getElementById('delivery-btn-label');
        const delBtn = document.getElementById('delivery-toggle-btn');

        if (!isStopped) {
            delCard.className = 'sc-toggle-card delivery-active';
            delIcon.textContent = '🚚';
            delLabel.textContent = 'Deliveries ACTIVE';
            delBtnIcon.textContent = '⛔';
            delBtnLabel.textContent = 'Stop Deliveries';
            delBtn.className = 'sc-big-btn delivery-active-btn';
        } else {
            delCard.className = 'sc-toggle-card delivery-stopped';
            delIcon.textContent = '🚫';
            delLabel.textContent = 'Deliveries STOPPED';
            delBtnIcon.textContent = '✅';
            delBtnLabel.textContent = 'Resume Deliveries';
            delBtn.className = 'sc-big-btn delivery-stopped-btn';
        }
    },

    async toggleStore() {
        const btn = document.getElementById('store-toggle-btn');
        btn.disabled = true;
        try {
            const settings = await API.get('/settings');
            const current = settings.store_open || '1';
            const newVal = current === '1' ? '0' : '1';
            await API.put('/settings', { store_open: newVal });
            this._renderStoreControls(newVal, settings.deliveries_stopped || '0');
            this.toast(newVal === '1' ? '🟢 Store is now OPEN!' : '🔴 Store is now CLOSED!', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
        finally { btn.disabled = false; }
    },

    async toggleDeliveries() {
        const btn = document.getElementById('delivery-toggle-btn');
        btn.disabled = true;
        try {
            const settings = await API.get('/settings');
            const current = settings.deliveries_stopped || '0';
            const newVal = current === '1' ? '0' : '1';
            await API.put('/settings', { deliveries_stopped: newVal });
            this._renderStoreControls(settings.store_open || '1', newVal);
            this.toast(newVal === '1' ? '⛔ Deliveries STOPPED!' : '🚚 Deliveries RESUMED!', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
        finally { btn.disabled = false; }
    },

    async saveAnnouncementSettings(e) {
        e.preventDefault();
        const enabled = document.getElementById('announcement-enabled').value;
        const text = document.getElementById('announcement-text').value;

        try {
            await API.put('/settings', {
                announcement_enabled: enabled,
                announcement_text: text
            });
            this.toast('Announcement settings saved! ✅', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    async saveBillingSettings(e) {
        e.preventDefault();
        const taxRate = document.getElementById('tax-rate').value;
        const deliveryEnabled = document.getElementById('delivery-enabled').value;
        const deliveryCharge = document.getElementById('delivery-charge').value;

        try {
            await API.put('/settings', {
                tax_rate: taxRate,
                delivery_enabled: deliveryEnabled,
                delivery_charge: deliveryCharge
            });
            this.toast('Billing settings saved! ✅', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    },

    // ================================================
    // UTILITIES
    // ================================================

    _fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    _statusBadge(status) {
        const map = {
            'Pending':          'badge-yellow',
            'Preparing':        'badge-blue',
            'Out for Delivery': 'badge-purple',
            'Delivered':        'badge-green',
            'Cancelled':        'badge-red',
            'Out of Stock':     'badge-gray',
            'EID Out of Stock': 'badge-gray',
        };
        return map[status] || 'badge-gray';
    },

    toast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        el.className = `toast toast-${type}`;
        el.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
        container.appendChild(el);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('visible'));
        });

        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 300);
        }, 3000);
    },
};

// ================================================
// SIDEBAR NAV CLICK
// ================================================
document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
    el.addEventListener('click', e => {
        e.preventDefault();
        panel.switchTab(el.dataset.tab);
    });
});

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('open');
    });
});

// ================================================
// BOOT
// ================================================
window.onload = () => panel.init();
