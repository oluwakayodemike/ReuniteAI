import axios from "axios";
import FormData from "form-data";
import { createItem, findSimilarItems } from "../models/itemModel.js";
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
