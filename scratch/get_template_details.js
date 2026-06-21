import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });

async function getTemplateDetails() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  // Step 1: Get WABA ID from Phone ID
  const phoneRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const phoneData = await phoneRes.json();
  console.log("Phone Number Info:", JSON.stringify(phoneData, null, 2));
  
  const wabaId = phoneData.id ? phoneData.id : null;

  // Step 2: Get templates using the WABA ID
  // First, try to get WABA ID from the phone number business
  const bizRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}?fields=wabaId,name,verified_name`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const bizData = await bizRes.json();
  console.log("\nBusiness data:", JSON.stringify(bizData, null, 2));

  // Try getting WABA from phone number endpoint  
  const wabaRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}?fields=id,display_phone_number,quality_rating,platform_type,messaging_limit_tier`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const wabaData = await wabaRes.json();
  console.log("\nWABA endpoint data:", JSON.stringify(wabaData, null, 2));

  // Try fetching templates from WABA ID (common pattern: get it from phone -> business account)
  const wabaIdRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/whatsapp_business_profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const wabaIdData = await wabaIdRes.json();
  console.log("\nBusiness Profile:", JSON.stringify(wabaIdData, null, 2));

  // Try direct template listing via business account
  // The WABA ID for Collectr should be discoverable. Let's try listing with name filter
  const templateName = "onboarding_first_message";
  
  // Try the owner business account route
  const ownerRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}?fields=owner`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const ownerData = await ownerRes.json();
  console.log("\nOwner (WABA):", JSON.stringify(ownerData, null, 2));

  // If we have the owner (WABA ID), list templates
  if (ownerData.owner) {
    const ownerWabaId = ownerData.owner;
    const tplRes = await fetch(`https://graph.facebook.com/v17.0/${ownerWabaId}/message_templates?name=${templateName}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tplData = await tplRes.json();
    console.log(`\nTemplate "${templateName}" details:`, JSON.stringify(tplData, null, 2));
  } else {
    console.log("\nCould not determine WABA ID from owner field. Trying common WABA endpoints...");
    
    // Try listing all message templates with different WABA discovery
    // Most Meta setups: phone belongs to a WABA. Let's use the business account search.
    const acctRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}?fields=account_type`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const acctData = await acctRes.json();
    console.log("\nAccount type:", JSON.stringify(acctData, null, 2));
  }
}

getTemplateDetails().catch(console.error);
