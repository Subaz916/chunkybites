// js/app.js — CHUNKY BITES Customer App (API-connected)

const app = {
    cart: [],
    authMode: 'login',
    activeCategory: 'All',
    heroSlideIndex: 0,
    heroItems: [],
    menu: [],
    currentUser: null,
    settings: {},

    benefits: [
        { title: "Super Fast Delivery",  desc: "Get your food hot and fresh in under 30 minutes, directly to your door.",      icon: "🚀", image: "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1600" },
        { title: "Premium Quality",      desc: "We use only the finest ingredients sourced locally to guarantee perfect taste.", icon: "⭐", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600" },
        { title: "24/7 Service",         desc: "Craving a midnight snack? We're open around the clock, every day of the year.", icon: "🕒", image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600" },
        { title: "Loyalty Rewards",      desc: "Earn points with every bite and unlock free meals and exclusive deals.",         icon: "🎁", image: "https://images.unsplash.com/photo-1549488344-c5c25eb64b63?auto=format&fit=crop&w=1600" },
    ],
    benefitIndex: 0,
    benefitImgActive: 'a',
    isFlippingBenefit: false,

    // ===================================================
    // INIT
    // ===================================================

    async init() {
        try {
            // Load user session and menu in parallel
            const [meRes, menuData] = await Promise.all([
                API.get('/auth/me'),
                API.get('/menu'),
            ]);
            this.currentUser = meRes.user;
            this.menu = menuData;
        } catch (err) {
            console.warn('Server not reachable:', err.message);
            this._showServerBanner();
            this.menu = [];
            this.currentUser = null;
        }

        await this.loadSettings();
        this.initGlobalScrollListener();

        this.updateNav();
        this.heroItems = this.menu.filter(i => i.status === 'active');

        if (this.heroItems.length > 0) {
            this.updateHeroDisplay();
            this.initScrollListener();
        }

        this.renderFeatured();
        this.renderBenefits();
        this.initBenefitsScrollListener();
        this.renderMenu();
        this.navigate('home');
    },

    initGlobalScrollListener() {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) {
                document.body.classList.add('scrolled');
            } else {
                document.body.classList.remove('scrolled');
            }
        });
    },

    async loadSettings() {
        try {
            const settings = await API.get('/settings');
            this.settings = settings;

            // Announcement bar
            const bar = document.getElementById('announcement-bar');
            if (bar && settings.announcement_enabled === '1') {
                const text1 = document.getElementById('marquee-text-1');
                const text2 = document.getElementById('marquee-text-2');
                if (text1) text1.textContent = settings.announcement_text;
                if (text2) text2.textContent = settings.announcement_text;
                bar.style.display = 'flex';
                document.body.classList.add('has-announcement-bar');
            } else if (bar) {
                bar.style.display = 'none';
                document.body.classList.remove('has-announcement-bar');
            }

            // Store closed overlay
            const storeOpen = settings.store_open !== '0';
            this._setStoreClosed(!storeOpen);

            // Deliveries stopped banner
            const deliveriesStopped = settings.deliveries_stopped === '1';
            this._setDeliveriesStopped(deliveriesStopped);

        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    },

    _setStoreClosed(isClosed) {
        let overlay = document.getElementById('store-closed-overlay');
        if (isClosed) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'store-closed-overlay';
                overlay.innerHTML = `
                    <div class="sc-overlay-box">
                        <div class="sc-overlay-icon">🔒</div>
                        <h2 class="sc-overlay-title">We're Closed Right Now</h2>
                        <p class="sc-overlay-msg">CHUNKY BITES is temporarily closed. We'll be back very soon!</p>
                        <div class="sc-overlay-badge">🍔 See you soon!</div>
                    </div>
                `;
                document.body.appendChild(overlay);
                requestAnimationFrame(() => overlay.classList.add('visible'));
            }
            document.body.classList.add('store-is-closed');
        } else {
            if (overlay) {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 500);
            }
            document.body.classList.remove('store-is-closed');
        }
    },

    _setDeliveriesStopped(isStopped) {
        let banner = document.getElementById('deliveries-stopped-banner');
        if (isStopped) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'deliveries-stopped-banner';
                banner.innerHTML = `
                    <span>⛔</span>
                    <span><strong>Deliveries Temporarily Paused</strong> — We're not accepting delivery orders right now. Please check back soon!</span>
                    <button onclick="this.parentElement.style.display='none'">✕</button>
                `;
                const annBar = document.getElementById('announcement-bar');
                if (annBar && annBar.nextSibling) {
                    annBar.parentNode.insertBefore(banner, annBar.nextSibling);
                } else {
                    document.body.prepend(banner);
                }
                requestAnimationFrame(() => banner.classList.add('visible'));
            }
        } else {
            if (banner) {
                banner.classList.remove('visible');
                setTimeout(() => banner.remove(), 400);
            }
        }
    },

    _showServerBanner() {
        const banner = document.createElement('div');
        banner.id = 'server-banner';
        banner.style.cssText = `
            position:fixed; top:0; left:0; right:0; z-index:9999;
            background:linear-gradient(90deg,#ef4444,#dc2626);
            color:white; text-align:center; padding:.6rem 1rem;
            font-size:.85rem; font-weight:600; font-family:Outfit,sans-serif;
        `;
        banner.innerHTML = '⚠️ Cannot connect to server. Run <strong>start_server.bat</strong> then refresh. &nbsp; <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:white;padding:.2rem .6rem;border-radius:6px;cursor:pointer;font-size:.8rem">✕</button>';
        document.body.prepend(banner);
    },

    navigate(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
        const view = document.getElementById(`view-${viewId}`);
        if (view) view.classList.add('active-view');

        if (viewId === 'menu')   this.renderMenu();
        if (viewId === 'cart')   this.renderCart();
        if (viewId === 'orders') this.renderOrders();
        if (viewId === 'home')   this.refreshHero();
        if (viewId === 'checkout') this.prefillCheckout();

        document.querySelector('.nav-links').classList.remove('active');
    },

    prefillCheckout() {
        if (this.currentUser) {
            document.getElementById('checkout-name').value = this.currentUser.name || '';
            document.getElementById('checkout-phone').value = this.currentUser.phone || '';
            document.getElementById('checkout-address').value = this.currentUser.address || '';
        }
    },

    toggleMobileNav() {
        document.querySelector('.nav-links').classList.toggle('active');
    },

    updateNav() {
        const u = this.currentUser;
        document.getElementById('nav-login').style.display  = u ? 'none' : 'inline-block';
        document.getElementById('nav-logout').style.display = u ? 'inline-block' : 'none';
        document.getElementById('nav-orders').style.display = u ? 'inline-block' : 'none';
        document.getElementById('nav-admin').style.display  = (u && u.role === 'admin') ? 'inline-block' : 'none';
    },

    async refreshHero() {
        try {
            const menuData = await API.get('/menu');
            this.menu = menuData;
            this.heroItems = this.menu.filter(i => i.status === 'active');
            if (this.heroItems.length > 0) this.updateHeroDisplay();
            this.renderFeatured();
        } catch (_) {}
    },

    // ===================================================
    // AUTH
    // ===================================================

    toggleAuthMode() {
        this.authMode = this.authMode === 'login' ? 'signup' : 'login';
        const isLogin = this.authMode === 'login';
        document.getElementById('auth-title').textContent       = isLogin ? 'Login' : 'Sign Up';
        document.getElementById('auth-submit').textContent      = isLogin ? 'Login' : 'Sign Up';
        document.getElementById('auth-switch-text').textContent = isLogin ? "Don't have an account?" : "Already have an account?";

        document.querySelectorAll('.signup-only').forEach(el => {
            el.style.display = isLogin ? 'none' : 'block';
            const inp = el.querySelector('input, textarea');
            if (inp) {
                if (isLogin) inp.removeAttribute('required');
                else         inp.setAttribute('required', 'required');
            }
        });
    },

    async handleAuth(e) {
        e.preventDefault();
        const email    = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const btn      = document.getElementById('auth-submit');
        btn.disabled = true;
        btn.textContent = '…';

        try {
            let res;
            if (this.authMode === 'login') {
                res = await API.post('/auth/login', { email, password });
            } else {
                const inputName = document.getElementById('auth-name') ? document.getElementById('auth-name').value : '';
                const name    = inputName || email.split('@')[0];
                const phone   = document.getElementById('auth-phone')   ? document.getElementById('auth-phone').value   : '';
                const address = document.getElementById('auth-address') ? document.getElementById('auth-address').value : '';
                res = await API.post('/auth/register', { name, email, password, phone, address });
            }

            this.currentUser = res.user;
            this.updateNav();
            document.getElementById('auth-form').reset();
            this.navigate('home');
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = this.authMode === 'login' ? 'Login' : 'Sign Up';
        }
    },

    async logout() {
        try { await API.post('/auth/logout'); } catch (_) {}
        this.currentUser = null;
        this.updateNav();
        this.navigate('home');
    },

    // ===================================================
    // MENU RENDERING
    // ===================================================

    renderFeatured() {
        const active = this.menu.filter(i => i.status !== 'hidden');
        const container = document.getElementById('featured-items');
        if (!container) return;
        container.innerHTML = active.slice(0, 3).map(item => this.createItemCard(item)).join('');
    },

    renderMenu() {
        const visibleItems = this.menu.filter(i => i.status !== 'hidden');

        // Category filters
        const cats = ['All', ...new Set(visibleItems.map(i => i.category_name))];
        const filterContainer = document.getElementById('category-filters');
        if (filterContainer) {
            filterContainer.innerHTML = cats.map(cat => `
                <button class="filter-btn ${this.activeCategory === cat ? 'active' : ''}"
                        onclick="app.filterMenu('${cat}')">${cat}</button>
            `).join('');
        }

        // Items
        const container = document.getElementById('menu-items');
        let items = this.activeCategory === 'All'
            ? visibleItems
            : visibleItems.filter(i => i.category_name === this.activeCategory);

        // Search Filter
        const searchInput = document.getElementById('menu-search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            const term = searchInput.value.trim().toLowerCase();
            items = items.filter(i => 
                i.name.toLowerCase().includes(term) || 
                (i.desc && i.desc.toLowerCase().includes(term))
            );
        }

        container.innerHTML = items.length
            ? items.map(item => this.createItemCard(item)).join('')
            : '<p style="text-align:center;color:#888;padding:3rem;width:100%">No items found matching your search.</p>';
    },

    filterMenu(category) {
        this.activeCategory = category;
        this.renderMenu();
    },

    createItemCard(item) {
        const isOutOfStock = item.status === 'Out of Stock' || item.status === 'EID Out of Stock';
        return `
            <div class="item-card ${isOutOfStock ? 'out-of-stock-card' : ''}">
                <div onclick="${isOutOfStock ? '' : `app.openDetailModal('${item.id}')`}" style="flex-grow:1;cursor:${isOutOfStock ? 'not-allowed' : 'pointer'}; opacity: ${isOutOfStock ? '0.6' : '1'};">
                    <img src="${item.image || ''}" alt="${item.name}" class="item-image"
                         onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                    <div class="item-details" style="padding-bottom:10px">
                        <h3 class="item-title">${item.name}</h3>
                        <p class="item-desc">${item.desc || ''}</p>
                    </div>
                </div>
                <div class="item-footer" style="padding:0 20px 20px">
                    <span class="item-price">PKR ${parseFloat(item.price).toFixed(2)}</span>
                    ${isOutOfStock 
                        ? `<span style="color: #ef4444; font-weight: bold; font-size: 0.9rem;">${item.status.toUpperCase()}</span>`
                        : `<button class="btn-primary" onclick="app.addToCart('${item.id}')">Add +</button>`
                    }
                </div>
            </div>
        `;
    },

    // ===================================================
    // BENEFITS
    // ===================================================

    renderBenefits() {
        const imgA = document.getElementById('benefits-bg-img-a');
        const imgB = document.getElementById('benefits-bg-img-b');
        if (!imgA) return;

        this.benefits.forEach(b => { const p = new Image(); p.src = b.image; });

        imgA.src = this.benefits[0].image;
        imgB.src = this.benefits[1] ? this.benefits[1].image : this.benefits[0].image;
        imgA.classList.add('visible-bg');
        imgB.classList.remove('visible-bg');

        this.benefitIndex    = 0;
        this.benefitImgActive = 'a';
        this.isFlippingBenefit = false;

        this.updateBenefitCard();
        this.renderBenefitDots();
    },

    updateBenefitCard() {
        const b = this.benefits[this.benefitIndex];
        ['num','icon','title','desc'].forEach(k => {
            const el = document.getElementById(`benefit-card-${k}`);
            if (!el) return;
            if (k === 'num')   el.textContent = String(this.benefitIndex + 1).padStart(2, '0');
            if (k === 'icon')  el.textContent = b.icon;
            if (k === 'title') el.textContent = b.title;
            if (k === 'desc')  el.textContent = b.desc;
        });
    },

    renderBenefitDots() {
        const dotsEl = document.getElementById('benefits-dots');
        if (!dotsEl) return;
        dotsEl.innerHTML = this.benefits.map((_, i) => `
            <span class="benefit-dot ${i === this.benefitIndex ? 'active-dot' : ''}"
                  onclick="app.goToBenefit(${i})"></span>
        `).join('');
    },

    goToBenefit(targetIndex) {
        if (this.isFlippingBenefit || targetIndex === this.benefitIndex) return;
        this.benefitIndex = targetIndex;
        this._executeBenefitFlip();
    },

    flipBenefit() {
        if (this.isFlippingBenefit) return;
        this.benefitIndex = (this.benefitIndex + 1) % this.benefits.length;
        this._executeBenefitFlip();
    },

    _executeBenefitFlip() {
        this.isFlippingBenefit = true;
        const card    = document.getElementById('benefit-card');
        const nextKey = this.benefitImgActive === 'a' ? 'b' : 'a';
        const currImg = document.getElementById(`benefits-bg-img-${this.benefitImgActive}`);
        const nextImg = document.getElementById(`benefits-bg-img-${nextKey}`);

        if (nextImg) nextImg.src = this.benefits[this.benefitIndex].image;
        if (card)    card.classList.add('flip-exit');

        setTimeout(() => {
            if (nextImg) nextImg.classList.add('visible-bg');
            if (currImg) currImg.classList.remove('visible-bg');
            this.benefitImgActive = nextKey;
            this.updateBenefitCard();
            this.renderBenefitDots();
            if (card) { card.classList.remove('flip-exit'); card.classList.add('flip-enter'); }
            setTimeout(() => { if (card) card.classList.remove('flip-enter'); this.isFlippingBenefit = false; }, 450);
        }, 410);
    },

    // ===================================================
    // DETAIL MODAL
    // ===================================================

    openDetailModal(id) {
        const item = this.menu.find(i => i.id === id);
        if (!item) return;

        document.getElementById('detail-image').src = item.image || '';
        document.getElementById('detail-title').textContent    = item.name;
        document.getElementById('detail-category').textContent = item.category_name || '';
        document.getElementById('detail-desc').textContent     = item.desc || '';
        document.getElementById('detail-price').textContent    = `PKR ${parseFloat(item.price).toFixed(2)}`;

        const addBtn = document.getElementById('detail-add-cart');
        const isOutOfStock = item.status === 'Out of Stock' || item.status === 'EID Out of Stock';
        
        if (isOutOfStock) {
            addBtn.textContent = item.status.toUpperCase();
            addBtn.style.backgroundColor = '#ef4444';
            addBtn.style.borderColor = '#ef4444';
            addBtn.style.cursor = 'not-allowed';
            addBtn.onclick = null;
        } else {
            addBtn.textContent = 'Add to Cart';
            addBtn.style.backgroundColor = '';
            addBtn.style.borderColor = '';
            addBtn.style.cursor = 'pointer';
            addBtn.onclick = () => { this.addToCart(item.id); this.closeDetailModal(); };
        }

        document.getElementById('product-detail-modal').style.display = 'block';
    },

    closeDetailModal() {
        document.getElementById('product-detail-modal').style.display = 'none';
    },

    // ===================================================
    // HERO SLIDER
    // ===================================================

    initScrollListener() {
        const heroSplit = document.querySelector('.hero-split');
        if (!heroSplit) return;
        let isScrolling = false;

        heroSplit.addEventListener('wheel', e => {
            if (isScrolling) { e.preventDefault(); return; }
            const max = Math.min(this.heroItems.length, 3) - 1;
            if (e.deltaY > 0 && this.heroSlideIndex < max) {
                e.preventDefault(); isScrolling = true;
                this.setHeroSlide(this.heroSlideIndex + 1);
                setTimeout(() => isScrolling = false, 600);
            } else if (e.deltaY < 0 && this.heroSlideIndex > 0 && window.scrollY <= 100) {
                e.preventDefault(); isScrolling = true;
                this.setHeroSlide(this.heroSlideIndex - 1);
                setTimeout(() => isScrolling = false, 600);
            }
        }, { passive: false });
    },

    initBenefitsScrollListener() {
        const section = document.getElementById('benefits-section');
        if (!section) return;
        let cooldown = false;
        section.addEventListener('wheel', e => {
            e.preventDefault();
            if (cooldown) return;
            if (e.deltaY > 40) {
                cooldown = true;
                this.flipBenefit();
                setTimeout(() => { cooldown = false; }, 950);
            }
        }, { passive: false });
    },

    setHeroSlide(index) {
        if (index === this.heroSlideIndex || !this.heroItems.length) return;
        this.heroSlideIndex = index;
        const img   = document.getElementById('hero-main-img');
        const title = document.getElementById('hero-title');
        const desc  = document.getElementById('hero-desc');
        if (img)   img.classList.add('fade-transition');
        if (title) title.style.opacity = 0;
        if (desc)  desc.style.opacity  = 0;
        setTimeout(() => {
            this.updateHeroDisplay();
            if (img)   img.classList.remove('fade-transition');
            if (title) title.style.opacity = 1;
            if (desc)  desc.style.opacity  = 1;
        }, 300);
    },

    updateHeroDisplay() {
        const item   = this.heroItems[this.heroSlideIndex];
        const img    = document.getElementById('hero-main-img');
        const title  = document.getElementById('hero-title');
        const desc   = document.getElementById('hero-desc');
        const thumbs = document.getElementById('hero-thumbnails');
        if (!item || !img) return;

        img.src = item.image || '';
        if (title) title.innerHTML = `Find your <br><span class="text-neon">${item.name}</span>`;
        if (desc)  desc.textContent = item.desc || '';

        const thumbList = this.heroItems.slice(0, 3);
        if (thumbs) {
            thumbs.innerHTML = thumbList.map((hi, idx) => `
                <div class="hero-thumb ${idx === this.heroSlideIndex ? 'active' : ''}"
                     onclick="app.setHeroSlide(${idx})">
                    <img src="${hi.image || ''}" alt="${hi.name}">
                    <span class="hero-thumb-price">PKR ${parseFloat(hi.price).toFixed(0)}</span>
                </div>
            `).join('');
        }
    },

    // ===================================================
    // CART
    // ===================================================

    addToCart(id) {
        const item = this.menu.find(i => i.id === id);
        if (!item || item.status === 'Out of Stock' || item.status === 'EID Out of Stock') return;
        const existing = this.cart.find(i => i.id === id);
        if (existing) existing.qty++;
        else          this.cart.push({ ...item, qty: 1 });
        this.updateCartCount();
        const nav = document.getElementById('nav-cart');
        nav.style.transform = 'scale(1.2)';
        setTimeout(() => nav.style.transform = 'scale(1)', 200);
    },

    updateCartCount() {
        const count = this.cart.reduce((s, i) => s + i.qty, 0);
        document.getElementById('cart-count').textContent = count;
    },

    renderCart() {
        const container = document.getElementById('cart-items');
        if (this.cart.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:2rem;color:#888">Your cart is empty.</p>';
            this.updateCartTotals();
            return;
        }

        container.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <img src="${item.image || ''}" alt="${item.name}"
                     onerror="this.src='https://via.placeholder.com/80?text=No+Image'">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p class="text-muted">PKR ${parseFloat(item.price).toFixed(2)}</p>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="app.updateQty('${item.id}', -1)">−</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="app.updateQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `).join('');

        this.updateCartTotals();
    },

    updateQty(id, change) {
        const idx = this.cart.findIndex(i => i.id === id);
        if (idx > -1) {
            this.cart[idx].qty += change;
            if (this.cart[idx].qty <= 0) this.cart.splice(idx, 1);
        }
        this.updateCartCount();
        this.renderCart();
    },

    updateCartTotals() {
        const subtotal = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
        const taxRate = parseFloat(this.settings.tax_rate || 10.0);
        const deliveryEnabled = this.settings.delivery_enabled === '1';
        const deliveryCharge = parseFloat(this.settings.delivery_charge || 50.0);
        
        const tax = subtotal * (taxRate / 100);
        let total = subtotal + tax;
        
        document.getElementById('cart-subtotal').textContent = `PKR ${subtotal.toFixed(2)}`;
        document.getElementById('cart-tax').textContent = `PKR ${tax.toFixed(2)} (${taxRate}%)`;
        
        const deliveryEl = document.getElementById('cart-delivery-row');
        if (deliveryEnabled) {
            total += deliveryCharge;
            if (deliveryEl) deliveryEl.style.display = 'flex';
            const deliveryAmt = document.getElementById('cart-delivery');
            if (deliveryAmt) deliveryAmt.textContent = `PKR ${deliveryCharge.toFixed(2)}`;
        } else {
            if (deliveryEl) deliveryEl.style.display = 'none';
        }
        
        document.getElementById('cart-total').textContent = `PKR ${total.toFixed(2)}`;
    },

    // ===================================================
    // CHECKOUT & ORDERS
    // ===================================================

    async placeOrder(e) {
        e.preventDefault();
        if (!this.currentUser) {
            alert('Please login to place an order.');
            this.navigate('login');
            return;
        }
        if (this.cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Placing Order…'; }

        try {
            await API.post('/orders', {
                user_email:     this.currentUser.email,
                customer_name:  document.getElementById('checkout-name').value,
                address:        document.getElementById('checkout-address').value,
                phone:          document.getElementById('checkout-phone').value,
                items: this.cart.map(i => ({
                    id:    i.id,
                    name:  i.name,
                    image: i.image,
                    price: i.price,
                    qty:   i.qty,
                })),
            });

            this.cart = [];
            this.updateCartCount();
            document.getElementById('checkout-form').reset();
            alert('✅ Order placed successfully!');
            this.navigate('orders');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
        }
    },

    async renderOrders() {
        if (!this.currentUser) return;
        const container = document.getElementById('user-orders');
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:#888">Loading orders…</p>';

        try {
            const orders = await API.get('/orders');
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (!orders.length) {
                container.innerHTML = '<p style="text-align:center;padding:2rem;color:#888">You have no orders yet.</p>';
                return;
            }

            const statusColor = {
                'Pending':          '#f59e0b',
                'Preparing':        '#3b82f6',
                'Out for Delivery': '#a855f7',
                'Delivered':        '#22c55e',
                'Cancelled':        '#ef4444',
                'Out of Stock':     '#9ca3af',
                'EID Out of Stock': '#6b7280',
            };

            container.innerHTML = orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <h3>Order #${order.id}</h3>
                        <span class="status-badge status-${order.status.toLowerCase().replace(/\s+/g,'-')}"
                              style="background:${statusColor[order.status] || '#888'}22;color:${statusColor[order.status] || '#888'}">
                            ${order.status}
                        </span>
                    </div>
                    <div class="order-details">
                        <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
                        <p><strong>Total:</strong> PKR ${parseFloat(order.total).toFixed(2)}</p>
                        <p><strong>Items:</strong> ${(order.items || []).map(i => i.qty + '× ' + i.item_name).join(', ')}</p>
                        ${order.status === 'Pending' ? `<button class="btn-primary" style="margin-top: 10px; background-color: #ef4444; border-color: #ef4444;" onclick="app.cancelOrder('${order.id}')">Cancel Order</button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = `<p style="text-align:center;padding:2rem;color:#ef4444">${err.message}</p>`;
        }
    },

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        try {
            await API.post(`/orders/${orderId}/cancel`);
            alert('Order cancelled successfully.');
            this.renderOrders();
        } catch (err) {
            alert('Error cancelling order: ' + err.message);
        }
    },
};

// Start
window.onload = () => app.init();
