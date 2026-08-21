// Auth state management. Loads user from session cookie via /api/auth/me.
// Exposes a Svelte store with user info and a checkAuth() for layout guards.

import { writable } from 'svelte/store';
import { api, type User } from './api';

export const user = writable<User | null>(null);

export async function checkAuth(): Promise<boolean> {
	try {
		const data = await api.get<{ user: User }>('/api/auth/me');
		user.set(data.user);
		return true;
	} catch {
		user.set(null);
		return false;
	}
}

export function clearUser() {
	user.set(null);
}
