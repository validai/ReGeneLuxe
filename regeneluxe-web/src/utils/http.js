// MODE 3 SAFETY:
// - Added fetch availability check
// - Added try/catch around body parsing
// - Prevents app crashes on network failures

export async function postForm(url, formData) {
  if (typeof fetch !== "function") {
    console.error("[http] fetch unavailable");
    return { error: "fetch_unavailable" };
  }

  try {
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) {
      return { error: "http_" + res.status };
    }
    try {
      return await res.json();
    } catch {
      return {};
    }
  } catch (err) {
    console.error("[http] network error", err);
    return { error: "network_error" };
  }
}
  