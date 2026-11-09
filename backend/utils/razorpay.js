const https = require("https");

function razorpayRequest(method, path, body) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error("Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    error.statusCode = 503;
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const request = https.request(
      {
        hostname: "api.razorpay.com",
        path,
        method,
        auth: `${keyId}:${keySecret}`,
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
        },
        timeout: 15000,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { responseBody += chunk; });
        response.on("end", () => {
          let data;
          try {
            data = JSON.parse(responseBody);
          } catch {
            return reject(new Error("Razorpay returned an unreadable response"));
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const error = new Error(data.error?.description || "Razorpay request failed");
            error.statusCode = 502;
            return reject(error);
          }
          resolve(data);
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Razorpay request timed out")));
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

module.exports = { razorpayRequest };
