import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import http from 'http';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const PORT = 3011;

async function handleRequest(req, res) {
  if (req.method === 'POST') {
    try {
      let parsedBody = {};
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      // Check if request has JSON body
      if (req.headers['content-type'] === 'application/json') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        await new Promise(resolve => req.on('end', resolve));
        try {
          parsedBody = JSON.parse(body);
          // Ensure htmlString exists and is a string
          if (!parsedBody.htmlString || typeof parsedBody.htmlString !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing or invalid htmlString in request body' }));
            return;
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
          return;
        }
      }
      
      // Get parameters from URL
      const htmlString = url.searchParams.get('htmlString') || parsedBody.htmlString;
      const apiKey = url.searchParams.get('apiKey') || parsedBody.apiKey;

      // Verify API key
      const apiKeys = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'API_KEY.json'), 'utf8')).validApiKeys;
      if (!apiKey || !apiKeys.includes(apiKey)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid API key' }));
        return;
      }


      if (!htmlString || typeof htmlString !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid htmlString in request body', details: { received: typeof htmlString, expected: 'string' } }));
        return;
      }

      // Ensure the public/generated_html directory exists
      const publicDir = path.join(process.cwd(), 'public');
      const generatedHtmlDir = path.join(publicDir, 'generated_html');

      try {
        await mkdir(generatedHtmlDir, { recursive: true });
      } catch (error) {
        // Ignore EEXIST error, which means the directory already exists
        if (error.code !== 'EEXIST') {
          console.error('Error creating directory:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to create directory for HTML files' }));
          return;
        }
      }

      // Generate a unique filename
      const fileName = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`;
      const filePath = path.join(generatedHtmlDir, fileName);

      // Preprocess HTML string to remove unwanted markdown markers
      const cleanedHtmlString = htmlString
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .trim();

      // Save the cleaned HTML string to the file
      await writeFile(filePath, cleanedHtmlString);

      // Construct the public URL
      // Vercel automatically serves files from the 'public' directory at the root
      const publicUrl = `https://code2html.dooleaf.cn/generated_html/${fileName}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'HTML saved successfully', url: publicUrl }));
    } catch (error) {
      console.error('Error saving HTML:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to save HTML content' }));
    }
  } else {
    if (req.url === '/favicon.ico') {
      res.writeHead(204, { 'Content-Type': 'image/x-icon' });
      res.end();
    } else {
      res.writeHead(405, { 'Allow': 'POST', 'Content-Type': 'text/plain' });
      res.end(`Method ${req.method} Not Allowed`);
    }
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}`);
});