// Thin fetch wrapper for the backend API.
// All requests include credentials (session cookie). Errors are extracted from JSON responses.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface User {
	id: string;
	username: string;
	display_name: string | null;
	about: string | null;
	avatar_path: string | null;
}

export interface CaptchaChallenge {
	id: string;
	challenge_data: Record<string, unknown>;
}

export interface Capture {
	id: string;
	title: string;
	status: string;
	what_text: string | null;
	where_text: string | null;
	why_text: string | null;
	when_text: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface CaptureImage {
	id: string;
	path: string;
	caption: string | null;
	sort_order: number;
	created_at: string;
}

export interface CaptureWithImages extends Capture {
	images: CaptureImage[];
}

export interface CaptureListItem extends Capture {
	image_count: number;
	url_count: number;
}

export interface CaptureUrl {
	url: string;
	capture_title: string;
	capture_status: string;
	capture_id: string;
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

	async upload<T>(path: string, formData: FormData): Promise<T> {
		const res = await fetch(`${BASE}${path}`, {
			method: 'POST',
			credentials: 'include',
			body: formData,
		});
		const data = await res.json();
		if (!res.ok) {
			throw new Error((data as ApiError).error ?? `HTTP ${res.status}`);
		}
		return data as T;
	}
}

export const api = new ApiClient();
