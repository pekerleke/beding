import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './assistants.module.scss';
import { Assistant } from './AssistantsList';

interface AssistantFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

interface AssistantSettingsProps {
  assistant: Assistant;
  onAssistantUpdated: (assistant: Assistant) => void;
}

const AssistantSettings: React.FC<AssistantSettingsProps> = ({ assistant, onAssistantUpdated }) => {
  const [files, setFiles] = useState<AssistantFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (assistant) {
      setPrompt(assistant.prompt || '');
      fetchFiles();
    }
  }, [assistant]);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<AssistantFile[]>(
        `http://localhost:9290/assistants/${assistant.id}/files`
      );
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Error al cargar los archivos del asistente');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptUpdate = async () => {
    try {
      setIsUpdating(true);
      setError('');
      setSuccess('');
      
      const response = await axios.put<Assistant>(
        `http://localhost:9290/assistants/${assistant.id}/prompt`,
        { prompt }
      );
      
      if (response.data) {
        onAssistantUpdated(response.data);
        setSuccess('Instrucciones actualizadas correctamente');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      setError('Error al actualizar las instrucciones');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      setIsUpdating(true);
      setError('');
      setSuccess('');
      
      const file = files[0];
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type
      };
      
      const response = await axios.post<Assistant>(
        `http://localhost:9290/assistants/${assistant.id}/files`,
        fileData
      );
      
      if (response.data) {
        onAssistantUpdated(response.data);
        setSuccess('Archivo cargado correctamente');
        fetchFiles();
        
        // Resetear el input de archivo
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Error al cargar el archivo');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.settingsContainer}>
      <h2>Configuración del Asistente</h2>
      
      <div className={styles.settingsSection}>
        <h3>Instrucciones personalizadas</h3>
        <p className={styles.sectionDescription}>
          Define cómo debe comportarse y responder este asistente.
        </p>
        <textarea
          className={styles.promptTextarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Instrucciones para el asistente..."
          rows={8}
          disabled={isUpdating}
        />
        <div className={styles.actionButtons}>
          <button 
            className={styles.saveButton}
            onClick={handlePromptUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Guardando...' : 'Guardar instrucciones'}
          </button>
        </div>
      </div>
      
      <div className={styles.settingsSection}>
        <h3>Archivos del asistente</h3>
        <p className={styles.sectionDescription}>
          Sube archivos que el asistente puede utilizar como referencia.
        </p>
        
        <div className={styles.fileUpload}>
          <input 
            type="file" 
            ref={fileInputRef}
            id="fileUpload" 
            onChange={handleFileUpload}
            disabled={isUpdating}
            className={styles.fileInput}
          />
          <label htmlFor="fileUpload" className={styles.fileUploadLabel}>
            {isUpdating ? 'Subiendo...' : 'Seleccionar archivo'}
          </label>
        </div>
        
        {isLoading ? (
          <p>Cargando archivos...</p>
        ) : files.length > 0 ? (
          <div className={styles.filesList}>
            <h4>Archivos cargados</h4>
            <ul>
              {files.map((file) => (
                <li key={file.id} className={styles.fileItem}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileDetails}>
                      {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.noFiles}>No hay archivos cargados</p>
        )}
      </div>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}
    </div>
  );
};

export default AssistantSettings; 