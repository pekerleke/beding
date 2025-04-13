import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader } from '../loader/Loader';
import FileContentViewer from '../assistants/FileContentViewer';
import ReactMarkdown from 'react-markdown';

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
    const [status, setStatus] = useState<"loading" | "error" | "success">();
    const [resources, setResources] = useState<string[]>([]);
    const [viewingSource, setViewingSource] = useState<SourceInfo | null>(null);

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
            setStatus("success");
        } catch (error) {
            setStatus("error");
            console.error('Error sending message:', error);
        }
    };

    const parseFileSource = (source: string): SourceInfo | null => {

        // Diferentes formatos posibles
        // 1. "Archivo: nombre_archivo.txt"
        if (source.startsWith('Archivo:')) {
            const fileName = source.replace('Archivo:', '').trim();
            return { fileName, fileId: extractFileId(fileName) };
        }

        // 2. Nombre del archivo directo (ej: "archivo.txt")
        if (source.endsWith('.txt') || source.includes('.')) {
            return { fileName: source, fileId: extractFileId(source) };
        }

        // 3. Intentar extraer un ID de archivo si está presente en la cadena
        const fileIdMatch = extractFileId(source);
        if (fileIdMatch !== `unknown-${Date.now()}`) {
            return { fileName: source, fileId: fileIdMatch };
        }

        return null;
    };

    const extractFileId = (source: string): string => {

        // 1. Comprobar si hay un patrón claro de file-ID
        const fileIdPattern = /file-[\w-]+/;
        const match = source.match(fileIdPattern);
        if (match) {
            return match[0];
        }

        // 2. Si la fuente ya tiene un formato que parece un ID UUID, usar eso
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const uuidMatch = source.match(uuidPattern);
        if (uuidMatch) {
            return uuidMatch[0];
        }

        // 3. Crear un ID genérico con un timestamp para garantizar unicidad
        const unknownId = `unknown-${Date.now()}`;
        return unknownId;
    };

    const handleSourceClick = async (source: string) => {

        const sourceInfo = parseFileSource(source);

        if (sourceInfo) {
            try {
                // Si el fileId es "unknown", intentamos encontrarlo consultando al backend
                if (sourceInfo.fileId.startsWith('unknown')) {
                    try {
                        // Obtener la lista de archivos del asistente
                        const filesResponse = await axios.get<AssistantFile[]>(
                            `http://localhost:9290/assistants/${assistantId}/files`
                        );

                        const files = filesResponse.data;

                        // Buscar el archivo por nombre exacto
                        let matchingFile = files.find(file => file.name === sourceInfo.fileName);

                        // Si no hay coincidencia exacta, buscar por nombre parcial
                        if (!matchingFile) {
                            matchingFile = files.find(file =>
                                sourceInfo.fileName.includes(file.name) ||
                                file.name.includes(sourceInfo.fileName)
                            );
                        }

                        if (matchingFile) {
                            sourceInfo.fileId = matchingFile.id;
                            sourceInfo.fileName = matchingFile.name; // Actualizar también el nombre
                        } else {
                            return;
                        }
                    } catch (error) {
                        console.error('Error al obtener la lista de archivos:', error);
                        return;
                    }
                }

                setViewingSource(sourceInfo);
            } catch (error) {
                console.error('Error general al procesar la fuente:', error);
            }
        }
    };

    const handleCloseSourceViewer = () => {
        setViewingSource(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.messagesArea}>
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`${styles.message} ${message.isUser ? styles.userMessage : styles.aiMessage}`}
                    >
                        <ReactMarkdown>
                            {message.text}
                        </ReactMarkdown>
                        {!message.isUser && index === messages.length - 1 && resources.length > 0 && (
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
                    </div>
                ))}
                <div ref={messagesEndRef} />
                {status === "loading" && <Loader />}
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