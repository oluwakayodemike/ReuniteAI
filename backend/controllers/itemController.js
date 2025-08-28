import axios from "axios";
import FormData from "form-data";
import { createItem, findSimilarItems, getItemById, getLatestLostItem } from "../models/itemModel.js";
import { createClaim  } from "../models/claimModel.js";
import { uploadImage } from "../utils/cloudinary.js"

const BENTO_URL = process.env.CLIP_API_URL;

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
    const { status, description, university, customLocation, lat, lng, date, verification_question, verification_answer } = req.body;
    const imageBuffer = req.file.buffer;

    const imageUrl = await uploadImage(imageBuffer);
    console.log('image uploaded successfully:', imageUrl);

    const form = new FormData();
    form.append("items", imageBuffer, req.file.originalname);

    console.log("Sending image for embedding...");
    const bentoResponse = await axios.post(BENTO_URL, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    const embedding = bentoResponse.data[0];
    console.log(`Saving '${status}' item to TiDB...`);
    await createItem({
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
    res.status(200).json({ message: "Item reported and saved successfully!" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
};

export const searchItems = async (req, res) => {
  try {
    const { description, university, customLocation, lat, lng, date } = req.body;
    const imageBuffer = req.file.buffer;

    const imageUrl = await uploadImage(imageBuffer);
    console.log('image uploaded successfully:', imageUrl);

    const form = new FormData();
    form.append("items", imageBuffer, req.file.originalname);

    console.log("Sending image for embedding...");
    const bentoResponse = await axios.post(BENTO_URL, form, {
      headers: { ...form.getHeaders() },
    });

    const embedding = bentoResponse.data[0];
    console.log("successfully got embed...");

    const cleanedDescription = cleanUpDesc(description);
    console.log(`Performing search with cleaned text: "${cleanedDescription}"`);


    const matches = await findSimilarItems(embedding, cleanedDescription);
    console.log("Found potential matches:", matches);

    await createItem({
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
    res.status(200).json({ message: "search complete", matches: matches });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "An error occurred during search." });
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
    const { foundItemId, claimantAnswer, claimantEmail } = req.body;
    console.log(`ReasoningAgent: Verifying claim for Found ID: ${foundItemId}`);

    const foundItem = await getItemById(foundItemId);
    const lostItem = await getLatestLostItem();

    if (!foundItem || !lostItem) {
      return res.status(404).json({ message: "Required item reports not found." });
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

    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const apiKey = process.env.GEMINI_API_KEY || ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    const geminiResponse = await axios.post(apiUrl, payload);
    const decision = geminiResponse.data.candidates[0].content.parts[0].text.trim().toLowerCase();
    
    console.log(`ReasoningAgent Decision: ${decision}`);

    if (decision === 'yes') {
      const pickupCode = `R-AI-${Math.floor(1000 + Math.random() * 9000)}`;
      
      await createClaim({
          lost_item_id: lostItem.id,
          found_item_id: foundItem.id,
          claimant_email: claimantEmail || 'claimant@reunite.ai',
          pickup_code: pickupCode
      });
    
      await updateItemStatusToClaimed(foundItem.id);

      res.status(200).json({ verified: true, pickupCode: pickupCode });
    } else {
      res.status(200).json({ verified: false, message: "Your claim has been submitted for manual review." });
    }
  } catch (error) {
    console.error("Error in verifyClaim:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "An error occurred during verification." });
  }
};
