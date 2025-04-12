import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader } from '../loader/Loader';
import FileContentViewer from '../assistants/FileContentViewer';

import styles from "./chat.module.scss";

interface Message {
    text: string;
    isUser: boolean;
}

interface ChatResponse {
    answer: string;
    sources?: string[];
}

interface ChatProps {
    assistantId: string;
}

interface SourceInfo {
    fileName: string;
    fileId: string;
}

interface AssistantFile {
    name: string;
    id: string;
}

const Chat: React.FC<ChatProps> = ({ assistantId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversationId = useRef<string>(Date.now().toString());
    // const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"loading" | "error" | "success">();
    const [resources, setResources] = useState<string[]>([]);
    const [viewingSource, setViewingSource] = useState<SourceInfo | null>(null);

    // Limpiar el chat cuando se cambia de asistente
    useEffect(() => {
        setMessages([]);
        setResources([]);
        conversationId.current = `${assistantId}-${Date.now().toString()}`;
    }, [assistantId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        const newMessage: Message = {
            text: inputMessage,
            isUser: true,
        };
        setMessages(prev => [...prev, newMessage]);
        setInputMessage('');

        try {
            // setIsLoading(true);
            setStatus("loading");
            const response = await axios.post<ChatResponse>('http://localhost:9290/chat', {
                question: inputMessage,
                assistantId,
                conversationId: conversationId.current
            });

            setResources(response.data.sources || []);
            const responseMessage: Message = {
                text: response.data.answer,
                isUser: false,
            };
            setMessages(prev => [...prev, responseMessage]);
            // setIsLoading(false);
            setStatus("success");
        } catch (error) {
            // setIsLoading(false);
            setStatus("error");
            console.error('Error sending message:', error);
        }
    };

    const parseFileSource = (source: string): SourceInfo | null => {
        console.log('Analizando fuente:', source);
        
        // Diferentes formatos posibles
        // 1. "Archivo: nombre_archivo.txt"
        if (source.startsWith('Archivo:')) {
            const fileName = source.replace('Archivo:', '').trim();
            console.log('Formato 1 detectado, fileName:', fileName);
            return { fileName, fileId: extractFileId(fileName) };
        }
        
        // 2. Nombre del archivo directo (ej: "archivo.txt")
        if (source.endsWith('.txt') || source.includes('.')) {
            console.log('Formato 2 detectado, fileName:', source);
            return { fileName: source, fileId: extractFileId(source) };
        }
        
        // 3. Intentar extraer un ID de archivo si está presente en la cadena
        const fileIdMatch = extractFileId(source);
        if (fileIdMatch !== `unknown-${Date.now()}`) {
            console.log('Formato 3 detectado, ID encontrado:', fileIdMatch);
            return { fileName: source, fileId: fileIdMatch };
        }
        
        console.log('No se pudo determinar el formato de la fuente:', source);
        return null;
    };

    const extractFileId = (source: string): string => {
        console.log('Extrayendo fileId de:', source);
        
        // 1. Comprobar si hay un patrón claro de file-ID
        const fileIdPattern = /file-[\w-]+/;
        const match = source.match(fileIdPattern);
        if (match) {
            console.log('ID encontrado por patrón file-*:', match[0]);
            return match[0];
        }
        
        // 2. Si la fuente ya tiene un formato que parece un ID UUID, usar eso
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const uuidMatch = source.match(uuidPattern);
        if (uuidMatch) {
            console.log('UUID encontrado:', uuidMatch[0]);
            return uuidMatch[0];
        }
        
        // 3. Crear un ID genérico con un timestamp para garantizar unicidad
        const unknownId = `unknown-${Date.now()}`;
        console.log('Usando ID genérico:', unknownId);
        return unknownId;
    };

    const handleSourceClick = async (source: string) => {
        console.log('Clickeada la fuente:', source);
        
        const sourceInfo = parseFileSource(source);
        console.log('Información de fuente extraída:', sourceInfo);

        if (sourceInfo) {
            try {
                // Si el fileId es "unknown", intentamos encontrarlo consultando al backend
                if (sourceInfo.fileId.startsWith('unknown')) {
                    console.log('ID desconocido, buscando archivo por nombre...');
                    try {
                        // Obtener la lista de archivos del asistente
                        const filesResponse = await axios.get<AssistantFile[]>(
                            `http://localhost:9290/assistants/${assistantId}/files`
                        );
                        console.log('Archivos disponibles:', filesResponse.data);
                        
                        const files = filesResponse.data;
                        
                        // Buscar el archivo por nombre exacto
                        let matchingFile = files.find(file => file.name === sourceInfo.fileName);
                        
                        // Si no hay coincidencia exacta, buscar por nombre parcial
                        if (!matchingFile) {
                            console.log('No se encontró coincidencia exacta, buscando coincidencia parcial...');
                            matchingFile = files.find(file => 
                                sourceInfo.fileName.includes(file.name) || 
                                file.name.includes(sourceInfo.fileName)
                            );
                        }
                        
                        if (matchingFile) {
                            console.log('Archivo encontrado:', matchingFile);
                            sourceInfo.fileId = matchingFile.id;
                            sourceInfo.fileName = matchingFile.name; // Actualizar también el nombre
                        } else {
                            console.error('No se pudo encontrar un archivo que coincida con:', sourceInfo.fileName);
                            console.error('Archivos disponibles:', files.map(f => f.name).join(', '));
                            return;
                        }
                    } catch (error) {
                        console.error('Error al obtener la lista de archivos:', error);
                        return;
                    }
                }
                
                console.log('Mostrando contenido del archivo:', sourceInfo);
                setViewingSource(sourceInfo);
            } catch (error) {
                console.error('Error general al procesar la fuente:', error);
            }
        } else {
            console.log('Fuente no reconocida como archivo:', source);
        }
    };

    const handleCloseSourceViewer = () => {
        setViewingSource(null);
    };

    // const handleNewChat = () => {
    //     setMessages([]);
    //     setResources([]);
    //     setStatus(undefined);
    //     conversationId.current = `${assistantId}-${Date.now().toString()}`;
    // };

    return (
        <div className={styles.container}>
            <div className={styles.messagesArea}>
                {/* <div className={styles.chatHeader}>
                    <button 
                        onClick={handleNewChat} 
                        className={styles.newChatButton}
                    >
                        Nuevo Chat
                    </button>
                </div> */}
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`${styles.message} ${message.isUser ? styles.userMessage : styles.aiMessage}`}
                    >
                        {message.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
                {status === "loading" && <Loader />}
                {(status === "success" && Boolean(resources?.length)) && (
                    <div className={styles.sourceContainer}>
                        Fuentes: {resources.map((source, index) => (
                            <React.Fragment key={index}>
                                <span 
                                    className={styles.sourceLink} 
                                    onClick={() => handleSourceClick(source)}
                                >
                                    {source}
                                </span>
                                {index < resources.length - 1 && ", "}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                {status === "error" && <div>Ups algo salio mal</div>}
            </div>
            <form onSubmit={handleSubmit} className={styles.inputForm}>
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Escribi tu pregunta..."
                    className={styles.input}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleSubmit(e);
                        }
                    }}
                />
                <button type="submit" className={styles.button}>
                    Enviar
                </button>
            </form>

            {viewingSource && (
                <FileContentViewer
                    assistantId={assistantId}
                    fileId={viewingSource.fileId}
                    fileName={viewingSource.fileName}
                    isOpen={!!viewingSource}
                    onClose={handleCloseSourceViewer}
                />
            )}
        </div>
    );
};

export default Chat; 