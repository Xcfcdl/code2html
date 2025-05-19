import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { htmlString } = req.body;

      if (!htmlString || typeof htmlString !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid htmlString in request body' });
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
          return res.status(500).json({ error: 'Failed to create directory for HTML files' });
        }
      }

      // Generate a unique filename
      const fileName = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`;
      const filePath = path.join(generatedHtmlDir, fileName);

      // Save the HTML string to the file
      await writeFile(filePath, htmlString);

      // Construct the public URL
      // Vercel automatically serves files from the 'public' directory at the root
      const publicUrl = `/generated_html/${fileName}`;

      res.status(200).json({ message: 'HTML saved successfully', url: publicUrl });
    } catch (error) {
      console.error('Error saving HTML:', error);
      res.status(500).json({ error: 'Failed to save HTML content' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}