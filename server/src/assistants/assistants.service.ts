/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AssistantFile {
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: Date;
}

export interface Assistant {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
    prompt?: string;
    files?: AssistantFile[];
}

export interface CreateAssistantDto {
    name: string;
    description: string;
    prompt?: string;
}

interface WeaviateObject {
    id: string;
    properties: {
        name: string;
        description: string;
        prompt?: string;
        createdAt: string;
        files?: string[];
    };
}

interface WeaviateAssistantResult {
    _additional: {
        id: string;
    };
    name: string;
    description: string;
    prompt?: string;
    createdAt: string;
    files?: string[];
}

interface WeaviateClass {
    class: string;
    // otras propiedades que puedan tener las clases
}

interface WeaviateSchemaResponse {
    classes: WeaviateClass[];
}

interface WeaviateCreateResponse {
    id: string;
}

interface WeaviateGraphQLResponse {
    data: {
        Get: {
            [className: string]: WeaviateAssistantResult[];
        };
    };
}

interface WeaviateFileObject {
    fileName: string;
    fileId: string;
    _additional: {
        id: string;
    };
}

interface WeaviateFileQueryResponse {
    data?: { 
        Get?: Record<string, WeaviateFileObject[]> 
    };
}

interface SearchResult {
    fileName: string;
    fileId: string;
    content: string;
    _additional?: {
        id: string;
        certainty?: number;
    };
}

interface FileContentObject {
    content: string;
}

@Injectable()
export class AssistantsService {
    private readonly ASSISTANT_CLASS_NAME = 'Assistant';
    private readonly UPLOADS_DIR = path.join(process.cwd(), 'uploads');

    constructor(private configService: ConfigService) {
        void this.initializeWeaviateSchema();
        void this.createUploadsDirectory();
    }

    private async createUploadsDirectory() {
        try {
            await fs.mkdir(this.UPLOADS_DIR, { recursive: true });
        } catch (error) {
            console.error('Error creating uploads directory:', error);
        }
    }

    private async initializeWeaviateSchema() {
        try {
            // Verificar si la clase ya existe
            const response = await axios.get<WeaviateSchemaResponse>(
                `${this.configService.get('WEAVIATE_HOST')}/v1/schema`,
            );

            const schema = response.data.classes || [];
            const classExists = schema.some(c => c.class === this.ASSISTANT_CLASS_NAME);

            if (!classExists) {
                // Crear la clase si no existe
                await axios.post(
                    `${this.configService.get('WEAVIATE_HOST')}/v1/schema`,
                    {
                        class: this.ASSISTANT_CLASS_NAME,
                        properties: [
                            {
                                name: 'name',
                                dataType: ['string'],
                            },
                            {
                                name: 'description',
                                dataType: ['string'],
                            },
                            {
                                name: 'prompt',
                                dataType: ['string'],
                            },
                            {
                                name: 'createdAt',
                                dataType: ['date'],
                            },
                            {
                                name: 'files',
                                dataType: ['string[]'],
                            },
                        ],
                    },
                );
            }
        } catch (error) {
            console.error('Error initializing Weaviate schema:', error);
        }
    }

    private async createInWeaviate(assistant: Assistant): Promise<string> {
        try {
            // Convertir files a un array de strings en lugar de un string JSON
            const fileStrings = assistant.files && assistant.files.length > 0 
                ? assistant.files.map(file => file.name)
                : [];

            const response = await axios.post<WeaviateCreateResponse>(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects`,
                {
                    class: this.ASSISTANT_CLASS_NAME,
                    properties: {
                        name: assistant.name,
                        description: assistant.description,
                        prompt: assistant.prompt || '',
                        createdAt: assistant.createdAt.toISOString(),
                        files: fileStrings, // Ahora es un array de strings en lugar de JSON
                    },
                },
            );
            return response.data.id;
        } catch (error) {
            console.error('Error creating assistant in Weaviate:', error);
            throw error;
        }
    }

    private formatAssistant(weaviateObject: WeaviateObject): Assistant {
        // Convertir array de nombres de archivos a objetos AssistantFile
        const files: AssistantFile[] = weaviateObject.properties.files
            ? weaviateObject.properties.files.map(fileName => {
                // Buscar el ID del archivo en el sistema de archivos físicos
                const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                return {
                    id: fileId,
                    name: fileName,
                    size: 0, // No tenemos el tamaño real
                    type: '', // No tenemos el tipo real
                    uploadedAt: new Date(),
                };
            })
            : [];

        return {
            id: weaviateObject.id,
            name: weaviateObject.properties.name,
            description: weaviateObject.properties.description,
            prompt: weaviateObject.properties.prompt,
            createdAt: new Date(weaviateObject.properties.createdAt),
            files,
        };
    }

    async findAll(): Promise<Assistant[]> {
        try {
            const response = await axios.post<WeaviateGraphQLResponse>(
                `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                {
                    query: `{
            Get {
              ${this.ASSISTANT_CLASS_NAME} {
                _additional {
                  id
                }
                name
                description
                prompt
                createdAt
                files
              }
            }
          }`,
                },
            );

            console.info(response.data);
            const graphQLData = response.data as unknown as WeaviateGraphQLResponse;
            const weaviateAssistants = graphQLData.data?.Get?.[this.ASSISTANT_CLASS_NAME] || [];
            
            if (weaviateAssistants.length === 0) {
                return [];
            }

            // Load existing assistants with correct file info
            const assistants: Assistant[] = [];
            
            for (const assistant of weaviateAssistants) {
                try {
                    // Get full assistant details with real file references
                    const fullAssistant = await this.findOne(assistant._additional.id);
                    if (fullAssistant) {
                        assistants.push(fullAssistant);
                    }
                } catch (error) {
                    console.error(`Error fetching assistant details: ${assistant._additional.id}`, error);
                    
                    // Fallback to basic info if finding with real files fails
                    const basicAssistant: Assistant = {
                        id: assistant._additional.id,
                        name: assistant.name,
                        description: assistant.description || '',
                        prompt: assistant.prompt || '',
                        createdAt: new Date(assistant.createdAt),
                        files: []
                    };
                    assistants.push(basicAssistant);
                }
            }

            return assistants;
        } catch (error) {
            console.error('Error fetching assistants from Weaviate:', error);
            return [];
        }
    }

    async findOne(id: string): Promise<Assistant | undefined> {
        try {
            const response = await axios.get<WeaviateObject>(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${id}`,
            );

            if (!response.data) {
                return undefined;
            }

            const assistant = this.formatAssistant(response.data);
            
            // Intentar obtener metadatos reales de archivos desde la clase de archivos del asistente
            try {
                // Obtener el listado de todos los embeddings de archivos para este asistente
                const className = this.getAssistantFileClassName(id);
                const filesResponse = await axios.post(
                    `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                    {
                        query: `{
                            Get {
                                ${className} {
                                    fileName
                                    fileId
                                    _additional {
                                        id
                                    }
                                }
                            }
                        }`
                    }
                );
                
                const filesData = filesResponse.data as WeaviateFileQueryResponse | undefined;
                const fileObjects = filesData?.data?.Get?.[className] || [];
                
                if (fileObjects.length > 0) {
                    // Crear una lista de archivos con IDs correctos desde Weaviate
                    const updatedFiles: AssistantFile[] = fileObjects.map((obj: WeaviateFileObject) => ({
                        id: obj.fileId || `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        name: obj.fileName,
                        size: 0,
                        type: '',
                        uploadedAt: new Date()
                    }));
                    
                    // Actualizar la lista de archivos del asistente
                    assistant.files = updatedFiles;
                }
            } catch (fileError) {
                console.error(`Error al obtener metadatos reales de archivos: ${id}`, fileError);
                // Continuar con los datos básicos del asistente si falla la carga de archivos
            }

            return assistant;
        } catch (error) {
            console.error(`Error fetching assistant with ID ${id} from Weaviate:`, error);
            return undefined;
        }
    }

    async create(createAssistantDto: CreateAssistantDto): Promise<Assistant> {
        const newAssistant: Assistant = {
            id: '', // Weaviate asignará un ID
            name: createAssistantDto.name,
            description: createAssistantDto.description,
            prompt: createAssistantDto.prompt || '',
            createdAt: new Date(),
            files: [],
        };

        try {
            const id = await this.createInWeaviate(newAssistant);
            newAssistant.id = id;
            
            // Crear clase específica para los archivos de este asistente
            await this.createAssistantFileSchema(id);
            
            return newAssistant;
        } catch (error) {
            console.error('Error creating assistant:', error);
            throw error;
        }
    }

    async update(id: string, updateData: CreateAssistantDto): Promise<Assistant | undefined> {
        try {
            const assistant = await this.findOne(id);
            if (!assistant) {
                return undefined;
            }

            // Actualizar en Weaviate
            await axios.patch(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${id}`,
                {
                    properties: {
                        name: updateData.name,
                        description: updateData.description,
                        prompt: updateData.prompt || ''
                    },
                },
            );

            // Devolver el asistente actualizado
            const updatedAssistant = {
                ...assistant,
                name: updateData.name,
                description: updateData.description,
                prompt: updateData.prompt || assistant.prompt
            };

            return updatedAssistant;
        } catch (error) {
            console.error(`Error updating assistant ${id}:`, error);
            throw error;
        }
    }

    async addFile(assistantId: string, file: AssistantFile, fileContent?: string): Promise<Assistant | undefined> {
        try {
            const assistant = await this.findOne(assistantId);
            if (!assistant) {
                return undefined;
            }

            if (!assistant.files) {
                assistant.files = [];
            }

            // Determinar el contenido del archivo
            let contentToUse = fileContent;
            
            // Si no se proporcionó contenido explícito, verificar si el archivo existe y leerlo
            if (!contentToUse) {
                try {
                    const filePath = path.join(this.UPLOADS_DIR, file.id);
                    // Verificar si el archivo existe
                    await fs.access(filePath);
                    // Verificar si es un archivo de texto
                    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                        contentToUse = await fs.readFile(filePath, 'utf8');
                    } else {
                        contentToUse = `Contenido del archivo ${file.name} (tipo: ${file.type})`;
                    }
                } catch (readError) {
                    console.error(`No se pudo leer el archivo ${file.id}:`, readError);
                    // Si no se puede leer, usar un contenido genérico
                    contentToUse = `Este es el contenido simulado para el archivo ${file.name}`;
                }
            }
            
            // Guardar el contenido del archivo si no existe físicamente
            if (!fileContent) {
                const filePath = path.join(this.UPLOADS_DIR, file.id);
                try {
                    // Verificar si el archivo ya existe antes de intentar escribirlo
                    try {
                        await fs.access(filePath);
                        console.info(`The file ${file.name} already exists in ${filePath}`);
                    } catch {
                        await fs.writeFile(filePath, contentToUse);
                        console.info(`File ${file.name} saved in ${filePath}`);
                    }
                } catch (writeError) {
                    console.error(`Error saving file ${file.id}:`, writeError);
                }
            }

            // Crear embedding para el archivo
            console.info(`Creating embedding for file ${file.name} with content of ${contentToUse.length} characters`);
            const embedding = await this.createEmbedding(contentToUse);
            
            // Guardar el embedding en la clase específica del asistente
            await this.saveFileEmbedding(assistantId, file, contentToUse, embedding);

            // Agregar el archivo a la lista de archivos del asistente
            assistant.files.push(file);

            // Crear array de nombres de archivos
            const fileNames = assistant.files.map(f => f.name);

            // Actualizar en Weaviate
            await axios.patch(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${assistantId}`,
                {
                    properties: {
                        files: fileNames, // Array de strings en lugar de JSON
                    },
                },
            );

            return assistant;
        } catch (error) {
            console.error(`Error adding file to assistant ${assistantId}:`, error);
            throw error;
        }
    }

    async removeFile(assistantId: string, fileId: string): Promise<Assistant | undefined> {
        try {
            const assistant = await this.findOne(assistantId);
            if (!assistant || !assistant.files) {
                console.error('Assistant not found or has no files');
                return undefined;
            }
            
            console.info('Files before removing file', assistant.files);
            
            // Encontrar el archivo y eliminarlo de la lista
            const fileToRemove = assistant.files.find(f => f.id === fileId);
            if (!fileToRemove) {
                console.info(`File ${fileId} not found in assistant`);
                return assistant; // El archivo no existe, devolver asistente sin cambios
            }
            
            console.info(`File found to remove: ${JSON.stringify(fileToRemove)}`);
            
            // Actualizar la lista de archivos
            assistant.files = assistant.files.filter(f => f.id !== fileId);
            const fileNames = assistant.files.map(f => f.name);
            
            console.info('Updated files list:', assistant.files);
            console.info('File names to update in Weaviate:', fileNames);
            
            // Actualizar en Weaviate
            try {
                await axios.patch(
                    `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${assistantId}`,
                    {
                        properties: {
                            files: fileNames,
                        },
                    },
                );
                console.info('Assistant object updated in Weaviate');
            } catch (updateError) {
                console.error('Error updating assistant in Weaviate:', updateError);
                throw updateError;
            }
            
            // Eliminar el archivo físico
            try {
                const filePath = path.join(this.UPLOADS_DIR, fileId);
                console.info(`Attempting to delete physical file in: ${filePath}`);
                await fs.unlink(filePath);
                console.info(`Physical file deleted: ${filePath}`);
            } catch (fileError) {
                console.error(`Error deleting physical file ${fileId}:`, fileError);
            }
            
            // Eliminar el embedding del archivo
            try {
                await this.deleteFileEmbedding(assistantId, fileId);
                console.info('File embedding deleted correctly');
            } catch (embeddingError) {
                console.error('Error deleting embedding:', embeddingError);
            }
            
            console.info('File deletion completed successfully');
            return assistant;
        } catch (error) {
            console.error(`Error removing file from assistant ${assistantId}:`, error);
            throw error;
        }
    }

    async getFiles(assistantId: string): Promise<AssistantFile[]> {
        try {
            const assistant = await this.findOne(assistantId);
            if (!assistant || !assistant.files) {
                return [];
            }
            return assistant.files;
        } catch (error) {
            console.error(`Error getting files for assistant ${assistantId}:`, error);
            return [];
        }
    }

    async updatePrompt(assistantId: string, prompt: string): Promise<Assistant | undefined> {
        try {
            const assistant = await this.findOne(assistantId);
            if (!assistant) {
                return undefined;
            }

            assistant.prompt = prompt;

            // Actualizar en Weaviate
            await axios.patch(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${assistantId}`,
                {
                    properties: {
                        prompt,
                    },
                },
            );

            return assistant;
        } catch (error) {
            console.error(`Error updating prompt for assistant ${assistantId}:`, error);
            throw error;
        }
    }

    // Métodos para manejar embeddings y clases específicas de asistentes
    
    private getAssistantFileClassName(assistantId: string): string {
        return `AssistantFile_${assistantId.replace(/-/g, '_')}`;
    }
    
    private async createAssistantFileSchema(assistantId: string): Promise<void> {
        try {
            const className = this.getAssistantFileClassName(assistantId);
            
            // Verificar si la clase ya existe
            try {
                await axios.get(`${this.configService.get('WEAVIATE_HOST')}/v1/schema/${className}`);
                console.info(`The class ${className} already exists`);
                return; // Si la clase ya existe, no hacer nada
            } catch {
                // La clase no existe, continuamos para crearla
                console.info(`Creating new class ${className}`);
            }
            
            // Crear la clase específica para los archivos de este asistente
            await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/schema`,
                {
                    class: className,
                    properties: [
                        { name: 'fileName', dataType: ['string'] },
                        { name: 'fileId', dataType: ['string'] },
                        { name: 'content', dataType: ['text'] }
                    ],
                    vectorIndexConfig: { distance: 'cosine' },
                    vectorizer: 'none' // Usaremos embeddings personalizados
                }
            );
            
            console.info(`Class ${className} created correctly`);
        } catch (error) {
            console.error(`Error creating schema for assistant ${assistantId}:`, error);
            throw error;
        }
    }
    
    private async createEmbedding(text: string): Promise<number[]> {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/embeddings',
                {
                    input: text,
                    model: 'text-embedding-3-small'
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}`
                    }
                }
            );
            
            // Use type assertion to specify the response structure
            const responseData = response.data as { data: { embedding: number[] }[] };
            const embedding = responseData.data[0].embedding;
            return embedding;
        } catch (error) {
            console.error('Error creating embedding:', error);
            throw error;
        }
    }
    
    private async saveFileEmbedding(
        assistantId: string,
        file: AssistantFile,
        content: string,
        vector: number[]
    ): Promise<void> {
        try {
            const className = this.getAssistantFileClassName(assistantId);
            
            await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects`,
                {
                    class: className,
                    vector,
                    properties: {
                        fileName: file.name,
                        fileId: file.id,
                        content
                    }
                }
            );
            
            console.info(`Embedding saved for file ${file.name}`);
        } catch (error) {
            console.error(`Error saving embedding for file ${file.name}:`, error);
            throw error;
        }
    }
    
    private async deleteFileEmbedding(assistantId: string, fileId: string): Promise<void> {
        try {
            const className = this.getAssistantFileClassName(assistantId);
            console.info(`Attempting to delete embedding for file ${fileId} in class ${className}`);
            
            // Buscar el objeto con el fileId correspondiente
            console.info(`Executing query to search objects with fileId=${fileId}`);
            const response = await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                {
                    query: `{
                        Get {
                            ${className}(where: {
                                path: ["fileId"],
                                operator: Equal,
                                valueText: "${fileId}"
                            }) {
                                _additional {
                                    id
                                }
                            }
                        }
                    }`
                }
            );
            
            // Extraer ID del objeto y eliminarlo
            const responseData = response.data as WeaviateFileQueryResponse | undefined;
            const objects = responseData?.data?.Get?.[className] || [];
            
            console.info(`Found ${objects.length} objects with fileId=${fileId}`);
            
            if (objects.length > 0) {
                for (const obj of objects) {
                    const objWithAdditional = obj;
                    const objectId = objWithAdditional._additional.id;
                    console.info(`Deleting object with ID: ${objectId}`);
                    
                    try {
                        await axios.delete(
                            `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${className}/${objectId}`
                        );
                        console.info(`Embedding deleted for file ${fileId}, object ${objectId}`);
                    } catch (deleteError: unknown) {
                        const err = deleteError as Error;
                        console.error(`Error deleting object ${objectId}:`, err.message);
                        const errWithResponse = deleteError as { response?: { data: unknown } };
                        if (errWithResponse.response) {
                            console.error('Details:', errWithResponse.response.data);
                        }
                    }
                }
            } else {
                console.info(`⚠️ No embeddings found for file ${fileId}`);
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error(`Error searching/deleting embeddings for file ${fileId}:`, err.message);
            const errWithResponse = error as { response?: { data: unknown } };
            if (errWithResponse.response) {
                console.error('Response details:', errWithResponse.response.data);
            }
        }
    }
    
    // Método para buscar en los archivos de un asistente específico
    async searchInAssistantFiles(assistantId: string, query: string): Promise<SearchResult[]> {
        try {
            // Primero crear el embedding de la consulta
            const queryEmbedding = await this.createEmbedding(query);
            
            // Obtener el nombre de la clase para este asistente
            const className = this.getAssistantFileClassName(assistantId);
            
            // Realizar la búsqueda vectorial
            const response = await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                {
                    query: `{
                        Get {
                            ${className}(
                                nearVector: {
                                    vector: ${JSON.stringify(queryEmbedding)}
                                }
                                limit: 5
                            ) {
                                fileName
                                fileId
                                content
                                _additional {
                                    id
                                    certainty
                                }
                            }
                        }
                    }`
                }
            );
            
            // Add type for the response data
            interface SearchResponse {
                data: {
                    Get: {
                        [key: string]: SearchResult[];
                    };
                };
            }
            
            const searchData = response.data as SearchResponse;
            return searchData?.data?.Get?.[className] || [];
        } catch (error) {
            console.error(`Error searching in assistant ${assistantId} files:`, error);
            return [];
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            // Primero verificar si el asistente existe
            const assistant = await this.findOne(id);
            if (!assistant) {
                return false;
            }

            // Eliminar todos los archivos asociados al asistente
            if (assistant.files && assistant.files.length > 0) {
                for (const file of assistant.files) {
                    try {
                        // Eliminar el archivo físico
                        const filePath = path.join(this.UPLOADS_DIR, file.id);
                        await fs.unlink(filePath);
                    } catch (error) {
                        console.error(`Error al eliminar archivo ${file.id}:`, error);
                        // Continuar aunque falle la eliminación física
                    }
                    // Eliminar el embedding del archivo
                    await this.deleteFileEmbedding(id, file.id);
                }
            }

            // Intentar eliminar la clase específica del asistente
            try {
                const className = this.getAssistantFileClassName(id);
                await axios.delete(
                    `${this.configService.get('WEAVIATE_HOST')}/v1/schema/${className}`
                );
                console.info(`Class ${className} deleted correctly`);
            } catch (error) {
                console.error(`Error deleting schema for assistant ${id}:`, error);
                // Continuar aunque falle la eliminación del esquema
            }

            // Eliminar el asistente de Weaviate
            await axios.delete(
                `${this.configService.get('WEAVIATE_HOST')}/v1/objects/${this.ASSISTANT_CLASS_NAME}/${id}`
            );

            return true;
        } catch (error) {
            console.error(`Error deleting assistant ${id}:`, error);
            return false;
        }
    }

    async getFileContent(assistantId: string, fileId: string): Promise<string> {
        try {
            // Primero intentar encontrar el archivo entre los archivos del asistente
            const assistant = await this.findOne(assistantId);
            if (!assistant || !assistant.files) {
                throw new Error(`Asistente no encontrado o no tiene archivos`);
            }

            // Verificar si el archivo pertenece al asistente
            const file = assistant.files.find(f => f.id === fileId);
            if (!file) {
                throw new Error(`Archivo ${fileId} no encontrado en el asistente ${assistantId}`);
            }

            // Intentar leer el contenido del archivo
            try {
                const filePath = path.join(this.UPLOADS_DIR, fileId);
                // Verificar si el archivo existe
                await fs.access(filePath);
                // Leer el contenido
                const content = await fs.readFile(filePath, 'utf8');
                return content;
            } catch (readError) {
                console.error(`Error reading physical file ${fileId}:`, readError);
                // Si no se puede leer el archivo físico, intentar obtener su contenido de Weaviate
                return this.getFileContentFromWeaviate(assistantId, fileId);
            }
        } catch (error) {
            console.error(`Error al obtener contenido del archivo ${fileId}:`, error);
            throw error;
        }
    }

    private async getFileContentFromWeaviate(assistantId: string, fileId: string): Promise<string> {
        try {
            const className = this.getAssistantFileClassName(assistantId);
            
            // Buscar el objeto con el fileId correspondiente
            const response = await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                {
                    query: `{
                        Get {
                            ${className}(where: {
                                path: ["fileId"],
                                operator: Equal,
                                valueText: "${fileId}"
                            }) {
                                content
                            }
                        }
                    }`
                }
            );
            
            const responseData = response.data as { data?: { Get?: Record<string, FileContentObject[]> } } | undefined;
            const objects = responseData?.data?.Get?.[className] || [];
            
            if (objects.length > 0 && objects[0].content) {
                return objects[0].content;
            }
            
            throw new Error(`No se encontró contenido para el archivo ${fileId} en Weaviate`);
        } catch (error) {
            console.error(`Error al obtener contenido de archivo desde Weaviate:`, error);
            return `No se pudo obtener el contenido del archivo.`;
        }
    }
} 