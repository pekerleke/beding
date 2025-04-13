import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const { OPENAI_API_KEY, WEAVIATE_HOST, CLASS_NAME } = process.env;
const documentsDir = path.resolve('documents');

const embed = async (text) => {
    const res = await axios.post("https://api.openai.com/v1/embeddings", {
        input: text,
        model: "text-embedding-3-small"
    }, {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });
    return res.data.data[0].embedding;
};

// Crear la clase si no existe
try {
    await axios.get(`${WEAVIATE_HOST}/v1/schema/${CLASS_NAME}`);
} catch {
    await axios.post(`${WEAVIATE_HOST}/v1/schema`, {
        class: CLASS_NAME,
        properties: [
            { name: "text", dataType: ["text"] },
            { name: "source", dataType: ["text"] }
        ],
        vectorIndexConfig: { distance: "cosine" },
        vectorizer: "none"
    });
}

const files = await fs.readdir(documentsDir);

for (const filename of files) {
    if (!filename.endsWith('.txt')) continue;

    const filePath = path.join(documentsDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const vector = await embed(content);

    try {
        await axios.post(`${WEAVIATE_HOST}/v1/objects`, {
            class: CLASS_NAME,
            vector,
            properties: {
                text: content,
                source: filename
            }
        });
        console.info(`✓ Cargado: ${filename}`);
    } catch (err) {
        console.error(`❌ Error con "${filename}":`, err.response?.data || err.message);
    }
}

console.info("📚 Carga completa.");
