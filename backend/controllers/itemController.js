import axios from "axios";
import FormData from "form-data";
import { Clerk } from "@clerk/clerk-sdk-node";
import { createItem, findSimilarItems, findSimilarLostItems, createNotification, batchCreateNotifications, getUserNotifications, markNotificationAsRead, getItemById, markAllNotificationsAsRead, getNotificationCount } from "../models/itemModel.js";
import { createClaim, approveClaimTransaction } from "../models/claimModel.js";
import { uploadImage } from "../utils/cloudinary.js"

const BENTO_URL = process.env.CLIP_API_URL;
const clerkClient = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

const cleanUpDesc = (text) => {
  if (!text) return '';

  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'for', 'with', 'about', 'is', 'it', 
    'from', 'my', 'of', 'and', 'to', 'was', 'were', 'has', 'had', 'i'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => !stopWords.has(word) && word.length > 1)
    .join(' ');
};


export const reportItem = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const { status, description, university, customLocation, lat, lng, date, verification_question, verification_answer } = req.body;
    const imageBuffer = req.file.buffer;

    console.log("running image upload and embedding generation in parallel...");

    const form = new FormData();
    form.append("items", imageBuffer, req.file.originalname);
    
    const [imageUrl, bentoResponse] = await Promise.all([
      uploadImage(imageBuffer),
      axios.post(BENTO_URL, form, {
        headers: { ...form.getHeaders() },
      }),
    ]);

    console.log('Image uploaded successfully:', imageUrl);
    console.log("Embedding received successfully.");

    const embedding = bentoResponse.data[0];
    console.log(`Saving '${status}' item to TiDB for user: ${userId}...`);
    const newItem = await createItem({
      user_id: userId,
      status,
      description,
      university,
      location: customLocation,
      latitude: lat,
      longitude: lng,
      item_date: date,
      embedding,
      image_url: imageUrl,
      verification_question,
      verification_answer
    });
    
    if (status === 'found') {
      console.log(`NotifyAgent: Searching for matching lost items for found ID: ${newItem.id}`);
      const potentialLostMatches = await findSimilarLostItems(JSON.parse(newItem.embedding), newItem.description, cleanUpDesc);
      
      const SIMILARITY_THRESHOLD = 0.20;

      const notificationsToCreate = potentialLostMatches
        .filter(match => match.distance < SIMILARITY_THRESHOLD)
        .map(match => {
          const message = `A potential match has been found for your lost item: '${match.description}'. Check your matches!`;
          return {
            user_id: match.user_id,
            message: message,
            lost_item_id: match.id,
            found_item_id: newItem.id
          };
        });
        
      if (notificationsToCreate.length > 0) {
        await batchCreateNotifications(notificationsToCreate);
      } else {
        console.log(`NotifyAgent: No matching lost items found.`);
      }
    }

    res.status(200).json({ message: "Item reported and saved successfully!" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Error reporting item!" });
  }
};

export const searchItems = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    const { description, university, customLocation, lat, lng, date } = req.body;
    const imageBuffer = req.file.buffer;

    const form = new FormData();
    form.append("items", imageBuffer, req.file.originalname);

    const [imageUrl, bentoResponse] = await Promise.all([
      uploadImage(imageBuffer),
      axios.post(BENTO_URL, form, { headers: { ...form.getHeaders() } })
    ]);
    const embedding = bentoResponse.data[0];
    console.log("successfully got embed...");

    const newLostItem = await createItem({
      user_id: userId,
      status: "lost",
      description,
      university,
      location: customLocation,
      latitude: lat,
      longitude: lng,
      item_date: date,
      embedding,
      image_url: imageUrl
    });

    res.status(200).json({ 
      message: "search initiated",
      lostItemId: newLostItem.id
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "An error occurred during search." });
  }
};

export const getMatchesForLostItem = async (req, res) => {
  try {
      const { lostItemId } = req.params;
      console.log(`fetching matches for lost-ID: ${lostItemId}`);

      const lostItem = await getItemById(lostItemId);
      if (!lostItem) {
          return res.status(404).json({ message: "report not found" });
      }

      const cleanedDescription = cleanUpDesc(lostItem.description);
      const matches = await findSimilarItems(JSON.parse(lostItem.embedding), cleanedDescription);

      res.status(200).json({ matches: matches });
  } catch (error) {
      console.error("Error fetching matches:", error.message);
      res.status(500).json({ message: "An error occurred while fetching matches." });
  }
};

export const startClaimProcess = async (req, res) => {
  try {
    const { foundItemId } = req.body;
    console.log(`ReasoningAgent: Starting claim for Found ID: ${foundItemId}`);
    
    const foundItem = await getItemById(foundItemId);
    
    if (!foundItem) {
      console.warn(`Claim started for non-existent item ID: ${foundItemId}`);
      return res.status(404).json({ message: "Item not found." });
    }

    if (foundItem.verification_question) {
      res.status(200).json({ question: foundItem.verification_question });
    } else {
      res.status(200).json({ question: "To help us verify your claim, please provide 2-3 unique details about your item that only you would know (e.g., a specific scratch, a sticker, what's inside a pocket)." });
    }
  } catch (error) {
    console.error("Error in startClaimProcess:", error.message);
    res.status(500).json({ message: "Error starting claim process." });
  }
};

export const verifyClaim = async (req, res) => {
  try {
    const { foundItemId, lostItemId, claimantAnswer } = req.body;
    if (!foundItemId || !lostItemId) {
      return res.status(400).json({ message: 'foundItemId and lostItemId are required.' });
    }

    let claimantEmail = 'claimant@reunite.ai';
    try {
      const claimant = await clerkClient.users.getUser(req.auth.userId);
      claimantEmail = claimant?.emailAddresses?.[0]?.emailAddress || claimantEmail;
    } catch (e) {
      console.warn('could not fetch claimant user from Clerk:', e.message);
    }

    const [foundItem, lostItem] = await Promise.all([
      getItemById(foundItemId),
      getItemById(lostItemId)
    ]);

    if (!foundItem || !lostItem) {
      return res.status(404).json({ message: 'Required item reports not found.' });
    }

    const prompt = `
      You are a security analyst for a university's AI-powered lost-and-found system. 
      Your primary goal is to prevent fraud. You must be very strict. Evaluate the following claim based on all available evidence. 
      The claimant must provide specific, non-obvious information that strongly suggests they are the true owner. Vague answers are not acceptable.

      **Evidence 1: The Finder's Report (The "Found" Item)**
      - Description: "${foundItem.description}"
      - Finder's Secret Question (if provided): "${foundItem.verification_question || 'Not provided.'}"
      - Finder's Secret Answer (known only to you): "${foundItem.verification_answer || 'Not provided.'}"

      **Evidence 2: The Claimant's Original Report (The "Lost" Item)**
      - Description: "${lostItem.description}"

      **Evidence 3: The Claimant's Verification Submission**
      - Their Answer: "${claimantAnswer}"

      **Your Task:**
      1.  Compare the claimant's answer with the finder's secret answer (if available). Is it a direct match?
      2.  Analyze the claimant's answer. Does it provide specific, unique, and non-obvious details that align with the descriptions (e.g., "a crack on the top left of the screen," "a sticker of a cat," "my old student ID in the front pocket")?
      3.  Compare the claimant's "lost" description with the finder's "found" description. Do they match closely?
      4.  Based on all evidence, does the claimant prove ownership beyond a reasonable doubt?

      Respond with only "yes" for AUTO_APPROVE or "no" for NEEDS_REVIEW.
    `;
    
    const kimiApiKey = process.env.MOONSHOT_API_KEY || '';
    const geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (!kimiApiKey || !geminiApiKey) {
      console.error('API keys missing');
      return res.status(500).json({ message: 'API keys not configured.' });
    }

    const kimiPayload = {
      model: 'kimi-thinking-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.0,
      stream: false
    };

    const geminiPayload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 512,
    },
    };

    let decisionRaw = '';
    let usedProvider = 'kimi';

    try {
      // primary: try kimi first
      const kimiResponse = await axios.post('https://api.moonshot.ai/v1/chat/completions', kimiPayload, {
        headers: { Authorization: `Bearer ${kimiApiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (kimiResponse.data?.choices && Array.isArray(kimiResponse.data.choices)) {
        decisionRaw = kimiResponse.data.choices[0]?.message?.content || '';
      } else {
        throw new Error('Unexpected Kimi response shape');
      }
    } catch (kimiErr) {
      console.warn(`Kimi failed: ${kimiErr.message}. Falling back to Gemini.`);
      usedProvider = 'gemini';

      try {
        // fallback: try gemini instead
        const geminiResponse = await axios.post(`https://generativelanguage.googleapis.com//v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`, geminiPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });

        if (geminiResponse.data?.candidates && Array.isArray(geminiResponse.data.candidates)) {
          decisionRaw = geminiResponse.data.candidates[0]?.content?.parts?.[0]?.text || '';
        } else {
          throw new Error('Unexpected Gemini response shape');
        }
      } catch (geminiErr) {
        console.error(`gemini also failed: ${geminiErr.message}`);
        console.warn("failing back to manual review since both AI providers failed.");

        try {
          const pending = await createClaim({
            lost_item_id: lostItem.id,
            found_item_id: foundItem.id,
            claimant_email: claimantEmail,
            pickup_code: null,
            status: 'PENDING'
          });
          console.log(`claim recorded as PENDING due to AI failure (id=${pending?.id})`);

          try {
            const finderUserId = foundItem.user_id;
            if (finderUserId) {
              const msg = `A claim has been submitted for the item "${foundItem.description?.slice(0,120) || 'an item'}" but AI verification failed. It is awaiting manual review.`;
              await createNotification({
                user_id: finderUserId,
                message: msg,
                lost_item_id: lostItem.id,
                found_item_id: foundItem.id
              });
              console.log(`pending notification sent to finder (user=${finderUserId})`);
            }
          } catch (notifErrII) {
            console.error("Failed to create pending notification after AI failure:", notifErrII);
          }

          return res.status(200).json({
            verified: false,
            message: "AI verification unavailable, claim has been submitted for manual review.",
            claimId: pending?.id || null
          });
        } catch (createErr) {
          console.error("Failed to create pending claim after AI failure:", createErr);
          return res.status(500).json({ message: "AI verification failed and claim could not be recorded." });
        }
      }
    }

    let decision = decisionRaw.trim().toLowerCase();
    if (decision !== 'yes' && decision !== 'no') {
      if (/\byes\b/i.test(decisionRaw) && !/\bno\b/i.test(decisionRaw)) decision = 'yes';
      else if (/\bno\b/i.test(decisionRaw) && !/\byes\b/i.test(decisionRaw)) decision = 'no';
      else {
        console.warn('unclear decision, defaulting to manual review:', decisionRaw);
        decision = 'no';
      }
    }
    console.log('Final decision:', decision);

    if (decision === 'yes') {
      const pickupCode = `R-AI-${Math.floor(1000 + Math.random() * 9000)}`;
      
      try {
        const result = await approveClaimTransaction({
          lost_item_id: lostItem.id,
          found_item_id: foundItem.id,
          claimant_email: claimantEmail,
          pickup_code: pickupCode
        });

        console.log(`Claim approved and items updated (claimId=${result.claim?.id})`);

        try {
          const ownerUserId = lostItem.user_id;
          const finderUserId = foundItem.user_id;
          const itemDesc = (lostItem.description || foundItem.description || "an item").slice(0, 120);

          let finderEmail = null;
          try {
            const finder = await clerkClient.users.getUser(foundItem.user_id);
            finderEmail =
              finder.emailAddresses?.[0]?.emailAddress || null;
          } catch (err) {
            console.error("Failed to fetch finder email from Clerk:", err);
          }

          // owners notification
          if (ownerUserId) {
            const ownerMsg = `Good news: your lost item "${itemDesc}" has been reunited. Pickup code: ${pickupCode}. ${
              finderEmail
                ? `Contact the finder at ${finderEmail} to arrange handoff.`
                : "Contact the finder to arrange handoff."
            }`;
            await createNotification({
              user_id: ownerUserId,
              message: ownerMsg,
              lost_item_id: lostItem.id,
              found_item_id: foundItem.id
            });
            console.log(`Notification created for owner (user=${ownerUserId})`);
          }

          // finders notification
          if (finderUserId && finderUserId !== ownerUserId) {
            const finderMsg = `Your found item "${itemDesc}" has been claimed and approved. Pickup code: ${pickupCode}. Await owner contact for handoff.`;
            await createNotification({
              user_id: finderUserId,
              message: finderMsg,
              lost_item_id: lostItem.id,
              found_item_id: foundItem.id
            });
            console.log(`notification created for finder (user=${finderUserId})`);
          }
        } catch (notifErr) {  
          console.error("failed to create notifications after approval:", notifErr);
        }

        return res.status(200).json({
          verified: true,
          pickupCode,
          claimId: result.claim?.id || null,
          found: result.found || null,
          lost: result.lost || null
        });
      } catch (txErr) {
        console.error("Failed to approve claim transaction:", txErr);
        return res.status(500).json({ message: "Failed to finalize claim." });
      }
    } else {
      // needs manual review
      try {
        const pending = await createClaim({
          lost_item_id: lostItem.id,
          found_item_id: foundItem.id,
          claimant_email: claimantEmail,
          pickup_code: null,
          status: 'PENDING'
        });
        console.log(`claim recorded as PENDING (id=${pending?.id})`);

        try {
          const finderUserId = foundItem.user_id;
          if (finderUserId) {
            const msg = `A claim has been submitted for the item "${foundItem.description?.slice(0,120) || 'an item'}" and is awaiting manual review.`;
            await createNotification({
              user_id: finderUserId,
              message: msg,
              lost_item_id: lostItem.id,
              found_item_id: foundItem.id
            });
            console.log(`pending notification sent to finder (user=${finderUserId})`);
          }
        } catch (notifErrII) {
          console.error("Failed to create pending notification:", notifErrII);
        }

        return res.status(200).json({
          verified: false,
          message: "your claim has been submitted for manual review.",
          claimId: pending?.id || null
        });
      } catch (createErr) {
        console.error("Failed to create pending claim:", createErr);
        return res.status(500).json({ message: "Failed to record claim for manual review." });
      }
    }
  } catch (error) {
    console.error("Error in verifyClaim:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "An error occurred during verification." });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    let isReadFilter;
    if (req.query.is_read === '0' || req.query.is_read === '1') {
      isReadFilter = parseInt(req.query.is_read);
    }

    const [notifications, total] = await Promise.all([
      getUserNotifications(userId, limit, offset, isReadFilter),
      getNotificationCount(userId, isReadFilter)
    ]);

    res.status(200).json({ notifications, total });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Error fetching notifications." });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ message: "Notification ID is required." });
    }

    await markNotificationAsRead(notificationId, userId);
    res.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Error in markNotificationRead:", error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: "Notification not found." });
    }
    res.status(500).json({ message: "Error marking notification as read." });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    await markAllNotificationsAsRead(userId);
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Error in markAllNotificationsRead:", error.message);
    res.status(500).json({ message: "Error marking all notifications as read." });
  }
};