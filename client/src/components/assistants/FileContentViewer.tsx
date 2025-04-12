import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';
import styles from './assistants.module.scss';

interface FileContentViewerProps {
  assistantId: string;
  fileId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

const FileContentViewer: React.FC<FileContentViewerProps> = ({
  assistantId,
  fileId,
  fileName,
  isOpen,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && fileId) {
      fetchFileContent();
    }
  }, [isOpen, fileId]);

  const fetchFileContent = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.get<{ content: string }>(
        `http://localhost:9290/assistants/${assistantId}/files/${fileId}/content`
      );
      
      setContent(response.data.content);
    } catch (error) {
      console.error('Error fetching file content:', error);
      setError('No se pudo cargar el contenido del archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contenido de ${fileName}`}
    >
      <div className={styles.fileContentViewer}>
        {isLoading ? (
          <div className={styles.loading}>Cargando contenido...</div>
        ) : error ? (
          <div className={styles.errorMessage}>{error}</div>
        ) : (
          <pre className={styles.fileContent}>{content}</pre>
        )}
      </div>
    </Modal>
  );
};

export default FileContentViewer; 