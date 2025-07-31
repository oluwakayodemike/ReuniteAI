import dotenv from 'dotenv';
import express from "express";
import cors from "cors";
import { connect } from "@tidbcloud/serverless";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BENTO_URL = process.env.CLIP_API_URL;

app.use(cors());
app.use(express.json());

const connection = connect({
  url: process.env.TIDB_CONNECTION_URL,
});


app.get("/", (req, res) => {
  res.send("ReuniteAI backend is running!");
});


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
