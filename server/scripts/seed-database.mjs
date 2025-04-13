import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEAVIATE_HOST = process.env.WEAVIATE_HOST;
const SERVER_URL = 'http://localhost:9290';
const ASSISTANT_CLASS_NAME = 'Assistant';
const SEED_FOLDER = path.join(__dirname, 'seed-files');

// Función para embedear texto
const embed = async (text) => {
    try {
        const res = await axios.post("https://api.openai.com/v1/embeddings", {
            input: text,
            model: "text-embedding-3-small"
        }, {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        });
        return res.data.data[0].embedding;
    } catch (error) {
        console.error('Error generating embeddings:', error.message);
        throw error;
    }
};

// Esperar hasta que el servidor esté disponible
async function waitForServer(maxRetries = 30, retryInterval = 2000) {
    console.info('Waiting for server to be available...');
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            await axios.get(`${SERVER_URL}/assistants`);
            console.info('Server is now available!');
            return true;
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.response?.status === 503) {
                console.info(`Server not ready yet, retrying in ${retryInterval/1000} seconds... (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            } else {
                console.info('Server is available but returned an error:', error.message);
                return true;
            }
        }
    }
    
    console.error(`Server not available after ${maxRetries} retries`);
    return false;
}

// Verificar si existen asistentes
async function checkAssistants() {
    try {
        console.info('Checking if assistants exist in the database...');
        const response = await axios.get(`${SERVER_URL}/assistants`);
        return response.data && response.data.length > 0;
    } catch (error) {
        console.error('Error checking assistants:', error.message);
        return false;
    }
}

// Crear un asistente con archivos del directorio seed-files
async function createAssistant() {
    try {
        console.info('Creating new assistant from seed files...');
        
        // Verificar si existe el directorio de seed-files
        try {
            await fs.access(SEED_FOLDER);
        } catch (error) {
            console.info('Creating seed-files directory...');
            await fs.mkdir(SEED_FOLDER, { recursive: true });
            console.info('No seed files found. Created empty directory. Please add files to seed-files folder.');
            return;
        }
        
        // Crear asistente
        const assistantData = {
            name: "Demo Assistant",
            description: "Info sobre equipos y aplicaciones",
            prompt: `You are a helpful assistant working for Sarasa Inc. 
Use the conversation history and the provided context to give the most accurate answer you can. 
Do not fabricate information. If the question is ambiguous, ask for clarification. 
Your final answer should be in Spanish.`
        };
        
        const response = await axios.post(`${SERVER_URL}/assistants`, assistantData);
        const assistantId = response.data.id;
        
        console.info(`Created assistant with ID: ${assistantId}`);
        
        // Leer y subir archivos
        const files = await fs.readdir(SEED_FOLDER);
        
        if (files.length === 0) {
            console.info('No seed files found in the seed-files directory.');
            return;
        }
        
        console.info(`Found ${files.length} files to upload.`);
        
        for (const filename of files) {
            const filePath = path.join(SEED_FOLDER, filename);
            const fileStats = await fs.stat(filePath);
            
            if (!fileStats.isFile()) continue;
            
            // Usando FormData nativo de Node.js (requiere instalar 'form-data')
            const FormData = (await import('form-data')).default;
            const formData = new FormData();
            
            formData.append('file', await fs.readFile(filePath), {
                filename: filename,
                contentType: 'application/octet-stream'
            });
            
            await axios.post(
                `${SERVER_URL}/assistants/${assistantId}/files`,
                formData,
                {
                    headers: formData.getHeaders()
                }
            );
            
            console.info(`Uploaded file: ${filename}`);
        }
        
        console.info('Assistant setup completed successfully.');
    } catch (error) {
        console.error('Error creating assistant:', error.message);
        throw error;
    }
}

// Función principal
async function seedDatabase() {
    try {
        // Esperar a que el servidor esté disponible antes de continuar
        const serverAvailable = await waitForServer();
        if (!serverAvailable) {
            console.error('Unable to connect to server, aborting database seeding.');
            return;
        }
        
        const assistantsExist = await checkAssistants();
        
        if (assistantsExist) {
            console.info('Assistants already exist in the database. Skipping seeding process.');
            return;
        }
        
        await createAssistant();
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

// Ejecutar la función principal
seedDatabase();