import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello from Express with TypeScript!' });
});

app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: Date.now()
  };
  
  res.status(200).json(healthData);
});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});