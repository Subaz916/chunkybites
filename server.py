# -*- coding: utf-8 -*-
# server.py -- CHUNKY BITES Flask Backend
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import uuid
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = 'chunky-bites-super-secret-2026-xK9mP'
app.permanent_session_lifetime = timedelta(days=7)

CORS(app, supports_credentials=True, origins=['*'],
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# ==================== DATABASE ====================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def row_to_dict(row):
    return dict(row) if row else None

def rows_to_list(rows):
    return [dict(r) for r in rows] if rows else []

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            created_at TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '🍽️',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            desc TEXT DEFAULT '',
            category_name TEXT DEFAULT '',
            price REAL NOT NULL,
            image TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT DEFAULT '',
            customer_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'Pending',
            notes TEXT DEFAULT '',
            date TEXT
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT,
            item_id TEXT DEFAULT '',
            item_name TEXT,
            item_image TEXT DEFAULT '',
            price REAL,
            qty INTEGER
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    ''')

    # Seed settings
    if not c.execute("SELECT key FROM settings WHERE key = 'announcement_enabled'").fetchone():
        c.execute("INSERT INTO settings (key, value) VALUES (?,?)", ('announcement_enabled', '1'))
        c.execute("INSERT INTO settings (key, value) VALUES (?,?)", ('announcement_text', '🔥 Welcome to CHUNKY BITES! Enjoy Super Fast Delivery across the city. | 🍔 Try our new Cyber Burger! | 🚚 Free Delivery on orders over PKR 1000! | 🕒 Open 24/7 for your midnight cravings!'))

    # Seed admin user
    admin = c.execute('SELECT id FROM users WHERE email = ?', ('admin@chunky.com',)).fetchone()
    if not admin:
        c.execute(
            'INSERT INTO users (id, name, email, password_hash, role, created_at, is_active) VALUES (?,?,?,?,?,?,?)',
            (str(uuid.uuid4()), 'System Admin', 'admin@chunky.com',
             generate_password_hash('admin123'), 'admin', datetime.now().isoformat(), 1)
        )

    # Seed categories
    if not c.execute('SELECT id FROM categories').fetchone():
        default_cats = [
            ('Pizza', '🍕', 1), ('Burger', '🍔', 2), ('Broast', '🍗', 3),
            ('Drinks', '🥤', 4), ('Desserts', '🍰', 5),
        ]
        for name, icon, order in default_cats:
            c.execute('INSERT INTO categories (id, name, icon, sort_order) VALUES (?,?,?,?)',
                      (str(uuid.uuid4()), name, icon, order))

    # Seed menu items
    if not c.execute('SELECT id FROM menu_items').fetchone():
        default_items = [
            ('Cyber Burger', 'Double beef patty with neon cheese and glitch sauce.', 'Burger', 12.99,
             'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1899&auto=format&fit=crop'),
            ('Neon Pizza', 'Pepperoni with glowing mozzarella and spicy oil.', 'Pizza', 18.50,
             'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1981&auto=format&fit=crop'),
            ('Crispy Broast', 'Futuristically fried chicken, crunchy and juicy.', 'Broast', 15.00,
             'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=2070&auto=format&fit=crop'),
            ('Plasma Cola', 'Electrifying signature drink.', 'Drinks', 3.50,
             'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=2070&auto=format&fit=crop'),
            ('Choco Lava Cake', 'Warm chocolate cake with molten center.', 'Desserts', 6.99,
             'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=1974&auto=format&fit=crop'),
        ]
        for name, desc, cat, price, image in default_items:
            c.execute(
                'INSERT INTO menu_items (id, name, desc, category_name, price, image, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
                (str(uuid.uuid4()), name, desc, cat, price, image, 'active', datetime.now().isoformat())
            )

    conn.commit()
    conn.close()
    print('[OK] Database initialized.')


# ==================== DECORATORS ====================

from functools import wraps

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required.'}), 403
        return f(*args, **kwargs)
    return decorated


# ==================== STATIC FILES ====================

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    # This will serve files like admin.html, css/style.css, js/app.js etc.
    if os.path.exists(os.path.join(app.static_folder, path)):
        return app.send_static_file(path)
    return "Not Found", 404


# ==================== AUTH ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required.'}), 400

    conn = get_db()
    user = row_to_dict(conn.execute('SELECT * FROM users WHERE email = ?', (data['email'],)).fetchone())
    conn.close()

    if not user or not check_password_hash(user['password_hash'], data['password']):
        return jsonify({'error': 'Invalid email or password.'}), 401

    if not user['is_active']:
        return jsonify({'error': 'Your account has been deactivated. Contact admin.'}), 403

    session.permanent = True
    session['user_id'] = user['id']
    session['role'] = user['role']

    safe = {k: v for k, v in user.items() if k != 'password_hash'}
    return jsonify({'user': safe})


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required.'}), 400

    conn = get_db()
    existing = conn.execute('SELECT id FROM users WHERE email = ?', (data['email'],)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'An account with this email already exists.'}), 400

    user_id = str(uuid.uuid4())
    name = data.get('name') or data['email'].split('@')[0]
    conn.execute(
        'INSERT INTO users (id, name, email, password_hash, phone, address, role, created_at, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
        (user_id, name, data['email'], generate_password_hash(data['password']),
         data.get('phone', ''), data.get('address', ''), 'user', datetime.now().isoformat(), 1)
    )
    conn.commit()
    user = row_to_dict(conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone())
    conn.close()

    session.permanent = True
    session['user_id'] = user['id']
    session['role'] = user['role']

    safe = {k: v for k, v in user.items() if k != 'password_hash'}
    return jsonify({'user': safe}), 201


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})


@app.route('/api/auth/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'user': None})
    conn = get_db()
    user = row_to_dict(conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone())
    conn.close()
    if not user:
        session.clear()
        return jsonify({'user': None})
    safe = {k: v for k, v in user.items() if k != 'password_hash'}
    return jsonify({'user': safe})


@app.route('/api/auth/change-password', methods=['POST'])
@require_auth
def change_password():
    data = request.get_json()
    conn = get_db()
    user = row_to_dict(conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone())

    if not check_password_hash(user['password_hash'], data.get('current_password', '')):
        conn.close()
        return jsonify({'error': 'Current password is incorrect.'}), 400

    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                 (generate_password_hash(data['new_password']), session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== CATEGORIES ====================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db()
    cats = rows_to_list(conn.execute('SELECT * FROM categories ORDER BY sort_order').fetchall())
    conn.close()
    return jsonify(cats)


@app.route('/api/categories', methods=['POST'])
@require_admin
def add_category():
    data = request.get_json()
    conn = get_db()
    max_ord = conn.execute('SELECT COALESCE(MAX(sort_order),0) as m FROM categories').fetchone()['m']
    cat_id = str(uuid.uuid4())
    conn.execute('INSERT INTO categories (id, name, icon, sort_order) VALUES (?,?,?,?)',
                 (cat_id, data['name'], data.get('icon', '🍽️'), max_ord + 1))
    conn.commit()
    cat = row_to_dict(conn.execute('SELECT * FROM categories WHERE id = ?', (cat_id,)).fetchone())
    conn.close()
    return jsonify(cat), 201


@app.route('/api/categories/<cat_id>', methods=['PUT'])
@require_admin
def update_category(cat_id):
    data = request.get_json()
    conn = get_db()
    conn.execute('UPDATE categories SET name = ?, icon = ? WHERE id = ?',
                 (data['name'], data.get('icon', '🍽️'), cat_id))
    conn.commit()
    cat = row_to_dict(conn.execute('SELECT * FROM categories WHERE id = ?', (cat_id,)).fetchone())
    conn.close()
    return jsonify(cat)


@app.route('/api/categories/<cat_id>', methods=['DELETE'])
@require_admin
def delete_category(cat_id):
    conn = get_db()
    conn.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== MENU ====================

@app.route('/api/menu', methods=['GET'])
def get_menu():
    conn = get_db()
    items = rows_to_list(conn.execute('SELECT * FROM menu_items ORDER BY created_at DESC').fetchall())
    conn.close()
    return jsonify(items)


@app.route('/api/menu', methods=['POST'])
@require_admin
def add_menu_item():
    data = request.get_json()
    conn = get_db()
    item_id = str(uuid.uuid4())
    conn.execute(
        'INSERT INTO menu_items (id, name, desc, category_name, price, image, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
        (item_id, data['name'], data.get('desc', ''), data.get('category_name', ''),
         float(data['price']), data.get('image', ''), data.get('status', 'active'), datetime.now().isoformat())
    )
    conn.commit()
    item = row_to_dict(conn.execute('SELECT * FROM menu_items WHERE id = ?', (item_id,)).fetchone())
    conn.close()
    return jsonify(item), 201


@app.route('/api/menu/<item_id>', methods=['PUT'])
@require_admin
def update_menu_item(item_id):
    data = request.get_json()
    conn = get_db()
    conn.execute(
        'UPDATE menu_items SET name=?, desc=?, category_name=?, price=?, image=?, status=? WHERE id=?',
        (data['name'], data.get('desc', ''), data.get('category_name', ''),
         float(data['price']), data.get('image', ''), data.get('status', 'active'), item_id)
    )
    conn.commit()
    item = row_to_dict(conn.execute('SELECT * FROM menu_items WHERE id = ?', (item_id,)).fetchone())
    conn.close()
    return jsonify(item)


@app.route('/api/menu/<item_id>', methods=['DELETE'])
@require_admin
def delete_menu_item(item_id):
    conn = get_db()
    conn.execute('DELETE FROM menu_items WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== ORDERS ====================

def _attach_items(conn, orders):
    for order in orders:
        order['items'] = rows_to_list(
            conn.execute('SELECT * FROM order_items WHERE order_id = ?', (order['id'],)).fetchall()
        )
    return orders


@app.route('/api/orders', methods=['GET'])
@require_auth
def get_orders():
    conn = get_db()
    if session.get('role') == 'admin':
        orders = rows_to_list(conn.execute('SELECT * FROM orders ORDER BY date DESC').fetchall())
    else:
        orders = rows_to_list(
            conn.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC', (session['user_id'],)).fetchall()
        )
    orders = _attach_items(conn, orders)
    conn.close()
    return jsonify(orders)


@app.route('/api/orders', methods=['POST'])
@require_auth
def place_order():
    data = request.get_json()
    conn = get_db()

    items = data.get('items', [])
    subtotal = sum(float(i['price']) * int(i['qty']) for i in items)
    tax = round(subtotal * 0.10, 2)
    total = round(subtotal + tax, 2)
    subtotal = round(subtotal, 2)
    order_id = 'ORD-' + str(uuid.uuid4())[:8].upper()

    conn.execute(
        'INSERT INTO orders (id, user_id, user_email, customer_name, phone, address, subtotal, tax, total, status, notes, date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        (order_id, session['user_id'], data.get('user_email', ''),
         data['customer_name'], data['phone'], data['address'],
         subtotal, tax, total, 'Pending', data.get('notes', ''), datetime.now().isoformat())
    )

    for item in items:
        conn.execute(
            'INSERT INTO order_items (order_id, item_id, item_name, item_image, price, qty) VALUES (?,?,?,?,?,?)',
            (order_id, item.get('id', ''), item['name'], item.get('image', ''), float(item['price']), int(item['qty']))
        )

    # Automatically update user's address book details for next time
    conn.execute(
        'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
        (data['customer_name'], data['phone'], data['address'], session['user_id'])
    )

    conn.commit()
    order = row_to_dict(conn.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone())
    order['items'] = rows_to_list(conn.execute('SELECT * FROM order_items WHERE order_id = ?', (order_id,)).fetchall())
    conn.close()
    return jsonify(order), 201


@app.route('/api/orders/<order_id>', methods=['PUT'])
@require_admin
def update_order(order_id):
    data = request.get_json()
    conn = get_db()
    if 'status' in data:
        conn.execute('UPDATE orders SET status = ? WHERE id = ?', (data['status'], order_id))
    if 'notes' in data:
        conn.execute('UPDATE orders SET notes = ? WHERE id = ?', (data['notes'], order_id))
    conn.commit()
    order = row_to_dict(conn.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone())
    if order:
        order['items'] = rows_to_list(conn.execute('SELECT * FROM order_items WHERE order_id = ?', (order_id,)).fetchall())
    conn.close()
    return jsonify(order)
@app.route('/api/orders/<order_id>/cancel', methods=['POST'])
@require_auth
def cancel_order(order_id):
    conn = get_db()
    # fetch order
    order = conn.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found.'}), 404
    if order['user_id'] != session['user_id']:
        conn.close()
        return jsonify({'error': "Cannot cancel others' orders."}), 403
    if order['status'] != 'Pending':
        conn.close()
        return jsonify({'error': 'Only pending orders can be cancelled.'}), 400
    conn.execute('UPDATE orders SET status = ? WHERE id = ?', ('Cancelled', order_id))
    conn.commit()
    updated = row_to_dict(conn.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone())
    updated['items'] = rows_to_list(conn.execute('SELECT * FROM order_items WHERE order_id = ?', (order_id,)).fetchall())
    conn.close()
    return jsonify(updated), 200


@app.route('/api/orders/<order_id>', methods=['DELETE'])
@require_admin
def delete_order(order_id):
    conn = get_db()
    conn.execute('DELETE FROM order_items WHERE order_id = ?', (order_id,))
    conn.execute('DELETE FROM orders WHERE id = ?', (order_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== USERS ====================

@app.route('/api/users', methods=['GET'])
@require_admin
def get_users():
    conn = get_db()
    users = rows_to_list(
        conn.execute('SELECT id, name, email, phone, address, role, created_at, is_active FROM users ORDER BY created_at DESC').fetchall()
    )
    for user in users:
        user['order_count'] = conn.execute('SELECT COUNT(*) as c FROM orders WHERE user_id = ?', (user['id'],)).fetchone()['c']
        spent = conn.execute("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE user_id = ? AND status != 'Cancelled'", (user['id'],)).fetchone()['s']
        user['total_spent'] = round(float(spent), 2)
    conn.close()
    return jsonify(users)


@app.route('/api/users/<user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    data = request.get_json()
    conn = get_db()
    if 'is_active' in data:
        conn.execute('UPDATE users SET is_active = ? WHERE id = ?', (int(data['is_active']), user_id))
    if 'role' in data:
        conn.execute('UPDATE users SET role = ? WHERE id = ?', (data['role'], user_id))
    conn.commit()
    user = row_to_dict(
        conn.execute('SELECT id, name, email, phone, role, created_at, is_active FROM users WHERE id = ?', (user_id,)).fetchone()
    )
    conn.close()
    return jsonify(user)


@app.route('/api/users/<user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    if user_id == session.get('user_id'):
        return jsonify({'error': 'Cannot delete your own account.'}), 400
    conn = get_db()
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== STATS ====================

@app.route('/api/stats', methods=['GET'])
@require_admin
def get_stats():
    conn = get_db()
    total_orders   = conn.execute('SELECT COUNT(*) as c FROM orders').fetchone()['c']
    total_revenue  = conn.execute("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'Cancelled'").fetchone()['s']
    total_users    = conn.execute("SELECT COUNT(*) as c FROM users WHERE role = 'user'").fetchone()['c']
    total_items    = conn.execute("SELECT COUNT(*) as c FROM menu_items WHERE status = 'active'").fetchone()['c']
    pending        = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Pending'").fetchone()['c']
    preparing      = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Preparing'").fetchone()['c']
    out_delivery   = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Out for Delivery'").fetchone()['c']
    delivered      = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Delivered'").fetchone()['c']
    cancelled      = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Cancelled'").fetchone()['c']
    out_of_stock   = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'Out of Stock'").fetchone()['c']
    eid_out_of_stock = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'EID Out of Stock'").fetchone()['c']

    recent = rows_to_list(conn.execute('SELECT * FROM orders ORDER BY date DESC LIMIT 6').fetchall())
    recent = _attach_items(conn, recent)
    conn.close()

    return jsonify({
        'total_orders':   total_orders,
        'total_revenue':  round(float(total_revenue), 2),
        'total_users':    total_users,
        'total_items':    total_items,
        'pending':        pending,
        'preparing':      preparing,
        'out_for_delivery': out_delivery,
        'delivered':      delivered,
        'cancelled':      cancelled,
        'out_of_stock':   out_of_stock,
        'eid_out_of_stock': eid_out_of_stock,
        'recent_orders':  recent,
    })


# ==================== SETTINGS ====================

@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db()
    rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    settings = {row['key']: row['value'] for row in rows}
    return jsonify(settings)

@app.route('/api/settings', methods=['PUT'])
@require_admin
def update_settings():
    data = request.get_json()
    conn = get_db()
    for key, value in data.items():
        conn.execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?', (key, str(value), str(value)))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== RUN ====================

if __name__ == '__main__':
    init_db()
    print('')
    print('  ======================================')
    print('  CHUNKY BITES Backend Server - Running')
    print('  URL:   http://localhost:5000')
    print('  Admin: admin@chunky.com / admin123')
    print('  ======================================')
    print('')
    app.run(debug=True, port=5000, host='0.0.0.0')
