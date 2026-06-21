import fetch from "node-fetch";

async function fetchMetaTemplate() {
  const url = "https://lekho-edge.collectr.workers.dev/api/admin/debug-template";
  // basic auth header for admin:admin123
  const authHeader = "Basic " + Buffer.from("admin:admin123").toString("base64");
  
  console.log("Calling endpoint:", url);
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": authHeader
      }
    });
    console.log("HTTP Status:", res.status);
    const data = await res.json();
    console.log("Response JSON:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

fetchMetaTemplate();
