  import axios from "axios";
  import FormData from "form-data";
  import { createItem, findSimilarItems } from "../models/itemModel.js";

  const BENTO_URL = process.env.CLIP_API_URL;

  export const reportItem = async (req, res) => {
    try {
      const { status, description, university, customLocation, lat, lng, date } = req.body;
      const imageBuffer = req.file.buffer;

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

      const form = new FormData();
      form.append("items", imageBuffer, req.file.originalname);

      console.log("Sending image for embedding...");
      const bentoResponse = await axios.post(BENTO_URL, form, {
        headers: { ...form.getHeaders() },
      });

      const embedding = bentoResponse.data[0];
      console.log("successfully got embed...");

      const matches = await findSimilarItems(embedding, description);
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
      });
      res.status(200).json({ message: "search complete", matches: matches });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ message: "An error occurred during search." });
    }
  };
