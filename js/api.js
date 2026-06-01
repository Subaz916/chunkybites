// js/api.js — Shared API Client for CHUNKY BITES

const isLocal = window.location.protocol === 'file:' || ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000');
const API_BASE = isLocal 
    ? 'http://127.0.0.1:5000/api' 
    : '/api';

const API = {
    async request(method, endpoint, data = null) {
        const options = {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        };
        if (data) options.body = JSON.stringify(data);

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, options);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
            return json;
        } catch (err) {
            if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
                throw new Error('🔌 Cannot connect to server. Please run start_server.bat first.');
            }
            throw err;
        }
    },
    get:    (ep)       => API.request('GET',    ep),
    post:   (ep, data) => API.request('POST',   ep, data),
    put:    (ep, data) => API.request('PUT',    ep, data),
    delete: (ep)       => API.request('DELETE', ep),
};
