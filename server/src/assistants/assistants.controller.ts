import { Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AssistantsService, Assistant, CreateAssistantDto, AssistantFile } from './assistants.service';

// Define un DTO para actualización
type UpdateAssistantDto = CreateAssistantDto;

// Ampliar la interfaz Request para incluir fileId
declare module 'express' {
  interface Request {
    fileId?: string;
  }
}

// Configuración de Multer para almacenar los archivos subidos
const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileId = `file-${uniqueSuffix}`;
    // Guardar el fileId en la solicitud para usarlo más tarde
    req.fileId = fileId;
    cb(null, fileId);
  },
});

@Controller('assistants')
export class AssistantsController {
  constructor(private readonly assistantsService: AssistantsService) {}

  @Get()
  async findAll(): Promise<Assistant[]> {
    return this.assistantsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Assistant | undefined> {
    return this.assistantsService.findOne(id);
  }

  @Post()
  async create(@Body() createAssistantDto: CreateAssistantDto): Promise<Assistant> {
    return this.assistantsService.create(createAssistantDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAssistantDto: UpdateAssistantDto
  ): Promise<Assistant | undefined> {
    return this.assistantsService.update(id, updateAssistantDto);
  }

  @Get(':id/files')
  async getFiles(@Param('id') id: string): Promise<AssistantFile[]> {
    return this.assistantsService.getFiles(id);
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', { storage }))
  async addFile(
    @Param('id') id: string, 
    @UploadedFile() file: Express.Multer.File,
    @Body() fileInfo: { name?: string }
  ): Promise<Assistant | undefined> {
    try {
      // Si no se proporciona un nombre, usar el nombre original del archivo
      const fileName = fileInfo.name || file.originalname;
      
      const assistantFile: AssistantFile = {
        id: path.basename(file.path),
        name: fileName,
        size: file.size,
        type: file.mimetype,
        uploadedAt: new Date(),
      };
      
      // Leer el contenido del archivo
      let fileContent = '';
      if (file.mimetype === 'text/plain' || fileName.endsWith('.txt')) {
        // Para archivos de texto, leer el contenido directamente
        fileContent = await fs.readFile(file.path, 'utf8');
      } else {
        // Para otros tipos de archivos, usar un mensaje genérico
        fileContent = `Contenido del archivo ${fileName} (tipo: ${file.mimetype})`;
      }
      
      return this.assistantsService.addFile(id, assistantFile, fileContent);
    } catch (error: any) {
      console.error('Error en la carga de archivo:', error);
      throw error;
    }
  }

  @Post(':id/files/batch')
  @UseInterceptors(FilesInterceptor('files', 10, { storage }))
  async addMultipleFiles(
    @Param('id') id: string, 
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<Assistant | undefined> {
    try {
      if (!files || files.length === 0) {
        return this.assistantsService.findOne(id);
      }
      
      let updatedAssistant: Assistant | undefined;
      
      // Process each file sequentially
      for (const file of files) {
        const fileName = file.originalname;
        
        const assistantFile: AssistantFile = {
          id: path.basename(file.path),
          name: fileName,
          size: file.size,
          type: file.mimetype,
          uploadedAt: new Date(),
        };
        
        // Leer el contenido del archivo
        let fileContent = '';
        if (file.mimetype === 'text/plain' || fileName.endsWith('.txt')) {
          // Para archivos de texto, leer el contenido directamente
          fileContent = await fs.readFile(file.path, 'utf8');
        } else {
          // Para otros tipos de archivos, usar un mensaje genérico
          fileContent = `Contenido del archivo ${fileName} (tipo: ${file.mimetype})`;
        }
        
        updatedAssistant = await this.assistantsService.addFile(id, assistantFile, fileContent);
      }
      
      return updatedAssistant;
    } catch (error) {
      console.error('Error en la carga de múltiples archivos:', error);
      throw error;
    }
  }

  @Delete(':id/files/:fileId')
  async removeFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string
  ): Promise<Assistant | undefined> {
    return this.assistantsService.removeFile(id, fileId);
  }

  @Put(':id/prompt')
  async updatePrompt(
    @Param('id') id: string,
    @Body() body: { prompt: string }
  ): Promise<Assistant | undefined> {
    return this.assistantsService.updatePrompt(id, body.prompt);
  }

  @Post(':id/search')
  async searchInFiles(
    @Param('id') id: string,
    @Body() body: { query: string }
  ): Promise<any[]> {
    return this.assistantsService.searchInAssistantFiles(id, body.query);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const result = await this.assistantsService.delete(id);
    return { success: result };
  }

  @Get(':id/files/:fileId/content')
  async getFileContent(
    @Param('id') id: string,
    @Param('fileId') fileId: string
  ): Promise<{ content: string }> {
    const content = await this.assistantsService.getFileContent(id, fileId);
    return { content };
  }
} 