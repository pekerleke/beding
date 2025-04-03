import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader } from '../loader/Loader';

import styles from "./chat.module.scss";

interface Message {
    text: string;
    isUser: boolean;
}

interface ChatResponse {
    answer: string;
    sources: {
        source: string,
        text: string
    }[]
}

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversationId = useRef<string>(Date.now().toString());
    const [isLoading, setIsLoading] = useState(false);
    const [resources, setResources] = useState<any>([]);

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
            setIsLoading(true);
            const response = await axios.post<ChatResponse>('http://localhost:3001/chat', {
                message: inputMessage,
                conversationId: conversationId.current,
            });

            setResources(response.data.sources)
            if (response.status === 201) {
                const responseMessage: Message = {
                    text: response.data.answer,
                    isUser: false,
                };
                setMessages(prev => [...prev, responseMessage]);
            }
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Error sending message:', error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.messagesArea}>
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`${styles.message} ${message.isUser ? styles.userMessage : styles.aiMessage}`}
                    >
                        {message.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
                {isLoading && <Loader />}
                {(!isLoading && Boolean(resources.length)) && (
                    <div className={styles.sourceContainer}>
                        Fuentes: {resources?.map((resource: any) => resource.source).join(", ")}
                    </div>
                )}
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
        </div>
    );
};

export default Chat; 