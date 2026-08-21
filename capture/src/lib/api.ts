// Thin fetch wrapper for the backend API.
// All requests include credentials (session cookie). Errors are extracted from JSON responses.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface User {
	id: string;
	username: string;
}

export interface CaptchaChallenge {
	id: string;
	challenge_data: Record<string, unknown>;
}

export interface Issue {
	id: string;
	title: string;
	body: string | null;
	type: string;
	status: string;
	severity: number | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface IssueListResult {
	issues: Issue[];
	total: number;
	limit: number;
	offset: number;
}

export interface Relation {
	id: string;
	source_id: string;
	target_id: string;
	relation_type: string;
	created_at: string;
}

export interface Comment {
	id: string;
	issue_id: string;
	user_id: string;
	username: string;
	body: string;
	created_at: string;
}

export interface ApiError {
	error: string;
}

class ApiClient {
	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const opts: RequestInit = {
			method,
			credentials: 'include',
			headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
		};
		if (body !== undefined) opts.body = JSON.stringify(body);

		const res = await fetch(`${BASE}${path}`, opts);

		if (res.status === 204) return undefined as T;

		const data = await res.json();
		if (!res.ok) {
			throw new Error((data as ApiError).error ?? `HTTP ${res.status}`);
		}
		return data as T;
	}

	get<T>(path: string) {
		return this.request<T>('GET', path);
	}

	post<T>(path: string, body?: unknown) {
		return this.request<T>('POST', path, body);
	}

	patch<T>(path: string, body?: unknown) {
		return this.request<T>('PATCH', path, body);
	}

	del<T>(path: string) {
		return this.request<T>('DELETE', path);
	}
}

export const api = new ApiClient();
