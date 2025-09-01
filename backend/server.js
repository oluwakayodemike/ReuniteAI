import dotenv from 'dotenv';
import express from "express";
import cors from "cors";
import itemRoutes from './routes/itemRoutes.js';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// routes
app.use('/api', ClerkExpressRequireAuth(), itemRoutes);

app.get("/", (req, res) => {
  res.send("ReuniteAI backend is running!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(401).send('Unauthenticated!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});