import React, { useState } from 'react';
import AssistantsList, { Assistant } from './AssistantsList';
import Chat from '../chat/Chat';
import styles from './assistants.module.scss';

const AssistantChat: React.FC = () => {
    const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);

    const handleSelectAssistant = (assistant: Assistant) => {
        setSelectedAssistant(assistant);
    };

    return (
        <div className={styles.mainContainer}>
            <AssistantsList
                onSelectAssistant={handleSelectAssistant}
                selectedAssistantId={selectedAssistant?.id || null}
            />
            <div className={styles.chatContainer}>
                {selectedAssistant ? (
                    <>
                        <div className={styles.chatHeader}>
                            <div>
                                <h2>{selectedAssistant.name}</h2>
                                <p>{selectedAssistant.description}</p>
                            </div>
                        </div>

                        <Chat assistantId={selectedAssistant.id} />
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.welcomeMessage}>
                            <h2>Bienvenido Beding</h2>
                            <p>Selecciona un asistente de la lista o crea uno nuevo para comenzar a chatear.</p>
                            <p>Cada asistente puede ser personalizado con instrucciones específicas y contenido de referencia.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssistantChat; 