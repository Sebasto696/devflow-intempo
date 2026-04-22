import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import generateRoute from './routes/generate.js';
import devopsRoute   from './routes/devops.js';
import reposRoute    from './routes/repos.js';
import docsRoute     from './routes/docs.js';
import sprintRoute   from './routes/sprint.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/generate', generateRoute);
app.use('/api/devops',   devopsRoute);
app.use('/api/repos',    reposRoute);
app.use('/api/docs',     docsRoute);
app.use('/api/sprint',   sprintRoute);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Backend corriendo en http://localhost:${PORT}`);
  console.log(`  Azure DevOps org: ${process.env.AZURE_DEVOPS_ORG || '⚠ no configurado'}`);
  console.log(`  Azure DevOps project: ${process.env.AZURE_DEVOPS_PROJECT || '⚠ no configurado'}`);
  console.log(`  API Key Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ configurada' : '⚠ no configurada'}\n`);
});
