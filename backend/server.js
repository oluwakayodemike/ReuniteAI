import dotenv from 'dotenv';
import express from "express";
import cors from "cors";
import itemRoutes from './routes/itemRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// routes
app.use('/api', itemRoutes);

app.get("/", (req, res) => {
  res.send("ReuniteAI backend is running!");
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});