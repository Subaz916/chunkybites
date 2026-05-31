// js/api.js — Shared API Client for CHUNKY BITES

const API_BASE = 'http://localhost:5000/api';

const API = {
    async request(method, endpoint, data = null) {
        const options = {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
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
