import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './assistants.module.scss';
import AssistantForm from './AssistantForm';
import Modal from './Modal';

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

interface AssistantsListProps {
    onSelectAssistant: (assistant: Assistant) => void;
    selectedAssistantId: string | null;
}

const AssistantsList: React.FC<AssistantsListProps> = ({ onSelectAssistant, selectedAssistantId }) => {
    const [assistants, setAssistants] = useState<Assistant[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null);

    const fetchAssistants = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get<Assistant[]>('http://localhost:9290/assistants');
            setAssistants(response.data);
        } catch (error) {
            console.error('Error fetching assistants:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssistants();
    }, [selectedAssistantId, onSelectAssistant]);

    const handleOpenModal = (assistant?: Assistant) => {
        if (assistant) {
            setEditingAssistant(assistant);
        } else {
            setEditingAssistant(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAssistant(null);
    };

    const handleAssistantCreated = (assistant: Assistant) => {
        setIsModalOpen(false);
        setEditingAssistant(null);
        setAssistants(prev => [...prev, assistant]);
        onSelectAssistant(assistant);
    };

    const handleAssistantUpdated = (updatedAssistant: Assistant) => {
        setIsModalOpen(false);
        setEditingAssistant(null);
        setAssistants(prev =>
            prev.map(a => a.id === updatedAssistant.id ? updatedAssistant : a)
        );

        // Si el asistente actualizado es el que está seleccionado, actualizar la selección
        if (selectedAssistantId === updatedAssistant.id) {
            onSelectAssistant(updatedAssistant);
        }
    };

    const handleAssistantDeleted = () => {
        setIsModalOpen(false);
        setEditingAssistant(null);

        // Recargar la lista de asistentes
        fetchAssistants();

        // Si el asistente eliminado es el que está seleccionado, deseleccionar
        if (selectedAssistantId === editingAssistant?.id) {
            onSelectAssistant({} as Assistant); // Deseleccionar enviando un objeto vacío
        }
    };

    const handleStartChat = (assistant: Assistant) => {
        onSelectAssistant(assistant);
    };

    return (
        <>
            <div className={styles.assistantsList}>
                <div className={styles.assistantsHeader}>
                    <h2>Asistentes</h2>
                    <button
                        className={styles.newAssistantButton}
                        onClick={() => handleOpenModal()}
                    >
                        + Crear Asistente
                    </button>
                </div>

                {isLoading ? (
                    <p>Cargando asistentes...</p>
                ) : (
                    <>
                        {assistants.length === 0 ? (
                            <div className={styles.noAssistants}>
                                <p>No hay asistentes disponibles.</p>
                                <p>Crea un nuevo asistente para comenzar.</p>
                            </div>
                        ) : (
                            <ul>
                                {assistants.map((assistant) => (
                                    <li
                                        key={assistant.id}
                                        className={`${styles.assistantItem} ${selectedAssistantId === assistant.id ? styles.selected : ''}`}
                                    >
                                        <div className={styles.assistantInfo}>
                                            <h3>{assistant.name}</h3>
                                            <p>{assistant.description}</p>
                                        </div>
                                        <div className={styles.assistantActions}>
                                            <button
                                                className={styles.chatButton}
                                                onClick={() => handleStartChat(assistant)}
                                                title="Iniciar chat"
                                            >
                                                💬
                                            </button>
                                            <button
                                                className={styles.editButton}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenModal(assistant);
                                                }}
                                                title="Editar asistente"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingAssistant ? "Editar Asistente" : "Crear Nuevo Asistente"}
            >
                <AssistantForm
                    assistant={editingAssistant}
                    onAssistantCreated={handleAssistantCreated}
                    onAssistantUpdated={handleAssistantUpdated}
                    onCancel={handleCloseModal}
                    onAssistantDeleted={handleAssistantDeleted}
                />
            </Modal>
        </>
    );
};

export default AssistantsList; 