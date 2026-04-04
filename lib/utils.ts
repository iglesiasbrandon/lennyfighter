export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

export function successResponse<T>(data: T, pagination?: { page: number; per_page: number; total: number }): Response {
  return jsonResponse({ success: true, data, ...(pagination ? { pagination } : {}) });
}
