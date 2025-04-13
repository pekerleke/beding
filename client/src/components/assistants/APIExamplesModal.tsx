import React, { useState } from 'react';
import Modal from './Modal';
import styles from './assistants.module.scss';
import { Assistant } from './AssistantsList';

interface APIExamplesModalProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: Assistant;
}

const APIExamplesModal: React.FC<APIExamplesModalProps> = ({
    isOpen,
    onClose,
    assistant
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
    const baseUrl = 'http://localhost:9290';

    const curlChatExample = `curl -X POST ${baseUrl}/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Tu pregunta aquí",
    "assistantId": "${assistant.id}",
    "conversationId": "ID-opcional-para-mantener-contexto"
  }'
`;

    const curlFileUploadExample = `curl -X POST ${baseUrl}/assistants/${assistant.id}/files \\
  -F "file=@/ruta/a/tu/archivo.txt" \\
  -F "name=nombre-del-archivo.txt"
`;

    const curlMultiFileUploadExample = `curl -X POST ${baseUrl}/assistants/${assistant.id}/files/batch \\
  -F "files=@/ruta/a/tu/archivo1.txt" \\
  -F "files=@/ruta/a/tu/archivo2.txt" \\
  -F "files=@/ruta/a/tu/archivo3.txt"
`;

    const chatResponseExample = `{
    "answer": "Respuesta del asistente basada en tu pregunta",
    "sources": ["opcional: lista de fuentes utilizadas"]
}`;

    const fileUploadResponseExample = `{
    "id": "${assistant.id}",
    "description": "${assistant.description}",
    "name": "${assistant.name}",
    "files": [
        {
            "id": "file-id",
            "name": "nombre-del-archivo.txt",
            "size": 12345,
            "type": "text/plain",
            "uploadedAt": "2023-07-25T12:34:56.789Z"
        }
    ]
}`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ejemplos de API"
        >
            <div className={styles.apiExamplesContainer}>
                <div className={styles.apiTabs}>
                    <button
                        className={`${styles.apiTabButton} ${activeTab === 'chat' ? styles.apiTabActive : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        API de Chat
                    </button>
                    <button
                        className={`${styles.apiTabButton} ${activeTab === 'files' ? styles.apiTabActive : ''}`}
                        onClick={() => setActiveTab('files')}
                    >
                        API de Archivos
                    </button>
                </div>

                <div className={styles.apiExampleContent}>
                    {activeTab === 'chat' ? (
                        <div>
                            <h3>Consultar al asistente</h3>
                            <p>Puedes enviar preguntas al asistente usando la API de chat:</p>

                            <h4>cURL</h4>
                            <pre className={styles.codeBlock}>
                                {curlChatExample}
                            </pre>

                            <h4>Respuesta</h4>
                            <pre className={styles.codeBlock}>
                                {chatResponseExample}
                            </pre>
                        </div>
                    ) : (
                        <div>
                            <h3>Subir archivos al asistente</h3>
                            <p>Puedes añadir archivos a este asistente usando la API de archivos:</p>

                            <h4>cURL - Un archivo</h4>
                            <pre className={styles.codeBlock}>
                                {curlFileUploadExample}
                            </pre>

                            <h4>cURL - Múltiples archivos</h4>
                            <pre className={styles.codeBlock}>
                                {curlMultiFileUploadExample}
                            </pre>

                            <h4>Respuesta</h4>
                            <pre className={styles.codeBlock}>
                                {fileUploadResponseExample}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default APIExamplesModal; 