import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });

async function createTemplate() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  
  if (!token || token.startsWith("EAAVA")) {
    console.error("Error: Please update WHATSAPP_ACCESS_TOKEN in .dev.vars with a valid, active token first.");
    process.exit(1);
  }

  // 1. Get WABA ID
  console.log("Fetching WhatsApp Business Account (WABA) ID...");
  const wabaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=whatsapp_business_account&access_token=${token}`);
  const wabaData = await wabaRes.json();
  
  if (!wabaRes.ok) {
    console.error("Failed to fetch WABA ID:", wabaData);
    process.exit(1);
  }
  
  const wabaId = wabaData.whatsapp_business_account?.id;
  console.log(`Successfully found WABA ID: ${wabaId}`);

  // 2. Register template
  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;
  const templatePayload = {
    name: "onboarding_first_message",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}! Your Chartered Accountant has requested documents. Please upload them securely by clicking the button below.\n\n*Note: This link expires in 7 days and is locked to your device once clicked.*",
        example: {
          body_text: [["ClientName"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Upload Documents",
            url: "https://lekho-edge.collectr.workers.dev/upload.html?t={{1}}",
            example: ["token-uuid-goes-here"]
          }
        ]
      }
    ]
  };

  console.log("Creating message template 'onboarding_first_message'...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(templatePayload)
  });

  const data = await res.json();
  if (res.ok) {
    console.log("Template created successfully!", JSON.stringify(data, null, 2));
  } else {
    console.error("Failed to create template:", JSON.stringify(data, null, 2));
  }
}

createTemplate();
