import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './assistants.module.scss';
import { Assistant, AssistantFile } from './AssistantsList';
import FileContentViewer from './FileContentViewer';

interface AssistantFormProps {
    assistant: Assistant | null;
    onAssistantCreated: (assistant: Assistant) => void;
    onAssistantUpdated: (assistant: Assistant) => void;
    onCancel: () => void;
    onAssistantDeleted?: () => void;
}

const AssistantForm: React.FC<AssistantFormProps> = ({ 
    assistant, 
    onAssistantCreated, 
    onAssistantUpdated, 
    onCancel,
    onAssistantDeleted
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [files, setFiles] = useState<AssistantFile[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [viewingFile, setViewingFile] = useState<AssistantFile | null>(null);

    // Cargar datos del asistente si estamos editando
    useEffect(() => {
        if (assistant) {
            setName(assistant.name);
            setDescription(assistant.description);
            setPrompt(assistant.prompt || '');
            setFiles(assistant.files || []);
            setPendingFiles([]);
        } else {
            setName('');
            setDescription('');
            setPrompt('');
            setFiles([]);
            setPendingFiles([]);
        }
    }, [assistant]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleAddPendingFile = () => {
        if (!selectedFile) return;
        
        // Crear un identificador único para este archivo pendiente
        const pendingFile: File = selectedFile;
        setPendingFiles(prev => [...prev, pendingFile]);
        setSelectedFile(null);
        
        // Limpiar el input de archivos
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemovePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleFileUpload = async () => {
        if (!selectedFile || !assistant) return;
        
        setIsUploadingFile(true);
        setError('');
        
        try {
            // Crear un objeto FormData para enviar el archivo
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('name', selectedFile.name);
            
            const response = await axios.post<Assistant>(
                `http://localhost:9290/assistants/${assistant.id}/files`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            
            // Actualizar la lista de archivos
            setFiles(response.data.files || []);
            setSelectedFile(null);
            
            // Limpiar el input de archivos
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            
        } catch (error) {
            console.error('Error uploading file:', error);
            setError('Error al subir el archivo. Por favor, inténtalo de nuevo.');
        } finally {
            setIsUploadingFile(false);
        }
    };

    const handleRemoveFile = async (fileId: string) => {
        if (!assistant) return;
        
        try {
            setIsSubmitting(true);
            setError('');
            
            console.log(`Intentando eliminar archivo con ID: ${fileId}`);
            console.log(`URL de la solicitud: http://localhost:9290/assistants/${assistant.id}/files/${fileId}`);
            
            const response = await axios.delete<Assistant>(`http://localhost:9290/assistants/${assistant.id}/files/${fileId}`);
            
            console.log('Respuesta de eliminación:', response.data);
            
            // Verificar si la respuesta tiene archivos actualizados
            if (response.data && response.data.files) {
                // Usar directamente los archivos actualizados de la respuesta
                setFiles(response.data.files);
            } else {
                // Filtrar manualmente si no hay lista actualizada en la respuesta
                setFiles(prev => prev.filter(file => file.id !== fileId));
            }
            
        } catch (error: any) {
            console.error('Error completo al eliminar archivo:', error);
            if (error.response) {
                console.error('Detalles de la respuesta:', error.response.data);
                console.error('Estado de la respuesta:', error.response.status);
            }
            setError('Error al eliminar el archivo. Por favor, inténtalo de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        if (!description.trim()) {
            setError('La descripción es obligatoria');
            return;
        }

        try {
            setIsSubmitting(true);
            setError('');

            if (assistant) {
                // Actualizar asistente existente
                const response = await axios.put<Assistant>(
                    `http://localhost:9290/assistants/${assistant.id}`,
                    {
                        name,
                        description,
                        prompt: prompt.trim() || undefined
                    }
                );
                
                onAssistantUpdated(response.data);
            } else {
                // Crear nuevo asistente
                const response = await axios.post<Assistant>(
                    'http://localhost:9290/assistants',
                    {
                        name,
                        description,
                        prompt: prompt.trim() || undefined
                    }
                );
                
                const newAssistant = response.data;
                
                // Si hay archivos pendientes, subirlos al nuevo asistente
                if (pendingFiles.length > 0) {
                    let updatedAssistant = newAssistant;
                    
                    for (const file of pendingFiles) {
                        try {
                            // Crear un objeto FormData para enviar el archivo
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('name', file.name);
                            
                            const fileResponse = await axios.post<Assistant>(
                                `http://localhost:9290/assistants/${newAssistant.id}/files`,
                                formData,
                                {
                                    headers: {
                                        'Content-Type': 'multipart/form-data'
                                    }
                                }
                            );
                            
                            updatedAssistant = fileResponse.data;
                        } catch (error) {
                            console.error('Error uploading file:', error);
                            // Continuar con el siguiente archivo aunque falle uno
                        }
                    }
                    
                    onAssistantCreated(updatedAssistant);
                } else {
                    onAssistantCreated(newAssistant);
                }
            }
            
            setName('');
            setDescription('');
            setPrompt('');
            setFiles([]);
            setPendingFiles([]);
        } catch (error) {
            console.error('Error saving assistant:', error);
            setError('Error al guardar el asistente. Por favor, inténtalo de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!assistant) return;
        
        try {
            setIsSubmitting(true);
            setError('');
            
            const response = await axios.delete(`http://localhost:9290/assistants/${assistant.id}`);
            
            if ((response.data as { success: boolean }).success) {
                if (onAssistantDeleted) {
                    onAssistantDeleted();
                }
                onCancel();
            } else {
                setError('No se pudo eliminar el asistente. Por favor, inténtalo de nuevo.');
            }
        } catch (error) {
            console.error('Error deleting assistant:', error);
            setError('Error al eliminar el asistente. Por favor, inténtalo de nuevo.');
        } finally {
            setIsSubmitting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleViewFileContent = (file: AssistantFile) => {
        setViewingFile(file);
    };

    const handleCloseFileViewer = () => {
        setViewingFile(null);
    };

    return (
        <div className={styles.formContainer}>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label htmlFor="name">Nombre</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre del asistente"
                        disabled={isSubmitting}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="description">Descripción</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe el propósito de este asistente"
                        rows={3}
                        disabled={isSubmitting}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="prompt">Instrucciones del asistente (opcional)</label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Instrucciones de comportamiento para el asistente"
                        rows={5}
                        disabled={isSubmitting}
                    />
                    <small className={styles.helpText}>Define cómo debe comportarse y responder el asistente.</small>
                </div>

                <div className={styles.formGroup}>
                    <label>Archivos</label>
                    {assistant ? (
                        // Mostrar archivos existentes para un asistente que se está editando
                        <>
                            {files.length > 0 ? (
                                <div className={styles.filesList}>
                                    {files.map(file => (
                                        <div key={file.id} className={styles.fileItem}>
                                            <span className={styles.fileName}>{file.name}</span>
                                            <div className={styles.fileActions}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewFileContent(file)}
                                                    className={styles.viewFileButton}
                                                    title="Ver contenido"
                                                >
                                                    👁️
                                                </button>
                                                <span className={styles.fileSize}>
                                                    {(file.size / 1024).toFixed(1)} KB
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(file.id)}
                                                    className={styles.removeFileButton}
                                                    title="Eliminar archivo"
                                                    disabled={isSubmitting}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noFiles}>No hay archivos asociados a este asistente.</p>
                            )}
                            
                            <div className={styles.fileUpload}>
                                <input
                                    type="file"
                                    id="file-upload"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    disabled={isUploadingFile || isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={handleFileUpload}
                                    className={styles.uploadButton}
                                    disabled={!selectedFile || isUploadingFile || isSubmitting}
                                >
                                    {isUploadingFile ? 'Subiendo...' : 'Subir archivo'}
                                </button>
                            </div>
                        </>
                    ) : (
                        // Mostrar archivos pendientes para un nuevo asistente
                        <>
                            {pendingFiles.length > 0 ? (
                                <div className={styles.filesList}>
                                    {pendingFiles.map((file, index) => (
                                        <div key={index} className={styles.fileItem}>
                                            <span className={styles.fileName}>{file.name}</span>
                                            <div className={styles.fileActions}>
                                                <span className={styles.fileSize}>
                                                    {(file.size / 1024).toFixed(1)} KB
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePendingFile(index)}
                                                    className={styles.removeFileButton}
                                                    title="Eliminar archivo"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noFiles}>Aún no has agregado archivos.</p>
                            )}
                            
                            <div className={styles.fileUpload}>
                                <input
                                    type="file"
                                    id="file-upload"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddPendingFile}
                                    className={styles.uploadButton}
                                    disabled={!selectedFile || isSubmitting}
                                >
                                    Agregar archivo
                                </button>
                            </div>
                        </>
                    )}
                    <small className={styles.helpText}>
                        Archivos que servirán como conocimiento adicional para el asistente.
                    </small>
                </div>
                
                <div className={styles.formActions}>
                    {assistant && (
                        <>
                            {showDeleteConfirm ? (
                                <div className={styles.deleteConfirmation}>
                                    <span className={styles.confirmText}>¿Estás seguro?</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className={styles.cancelButton}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className={styles.deleteButton}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className={styles.deleteButton}
                                    disabled={isSubmitting}
                                >
                                    Eliminar Asistente
                                </button>
                            )}
                        </>
                    )}
                    <div className={styles.rightActions}>
                        <button
                            type="button"
                            onClick={onCancel}
                            className={styles.cancelButton}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={isSubmitting}
                        >
                            {isSubmitting 
                                ? (assistant ? 'Actualizando...' : 'Creando...') 
                                : (assistant ? 'Actualizar' : 'Crear Asistente')}
                        </button>
                    </div>
                </div>
            </form>

            {viewingFile && assistant && (
                <FileContentViewer
                    assistantId={assistant.id}
                    fileId={viewingFile.id}
                    fileName={viewingFile.name}
                    isOpen={!!viewingFile}
                    onClose={handleCloseFileViewer}
                />
            )}
        </div>
    );
};

export default AssistantForm; 