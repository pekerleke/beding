# Beding

Beding es una plataforma que permite crear múltiples asistentes con contexto personalizado y acceder a ellos via API. Esta herramienta facilita la integración de asistentes inteligentes en diversas aplicaciones y servicios.​

La aplicación de demostración de chat de Beding permite cargar documentos en Weaviate para obtener contexto tipo RAG (Retrieval-Augmented Generation). Utiliza técnicas como condensación de consultas, generación de embeddings y recuperación de información para generar respuestas contextuales mediante la API de OpenAI.

<img width="1216" alt="Screenshot 2025-04-13 at 17 47 34" src="https://github.com/user-attachments/assets/f4246482-1fc0-4ed2-967b-447e81bae17f" />

## Características

- **Chat interactivo:** Habla con el sistema y recibí respuestas con contexto.
- **Carga de documentos:** Importá documentos en Weaviate para enriquecer el contexto.
- **Historial interno por sesión:** Incorpora un historial por sesión de usuario, permitiendo mantener un contexto separado por cada pestaña
- **Condensación de consultas:** Optimiza las consultas para obtener respuestas más precisas.
- **Embeddings:** Convierte el texto en representaciones vectoriales.
- **Integración con OpenAI:** Se conecta a OpenAI para generar respuestas más naturales y acertadas.

<img width="1216" alt="Screenshot 2025-04-13 at 17 47 45" src="https://github.com/user-attachments/assets/dc5dde27-2f1c-4754-96e1-ca8927012051" />
<img width="1216" alt="Screenshot 2025-04-13 at 17 47 58" src="https://github.com/user-attachments/assets/cb495c71-aace-4ae7-a30e-c45a004b8b07" />


## Requisitos

- **Node.js**
- **Docker**
- **OpenAI api key** (se debe setear en `/server/.env`)

## Instalación y Ejecución

Seguí los pasos en la [Wiki de la App](https://github.com/pekerleke/semantic-search-chat-demo/wiki) para levantar la aplicación por primera vez.

## Notas

Esta aplicación es solo una demo pensada para probar el potencial de la integración entre sistemas de búsqueda semántica y generación de respuestas contextualizadas con contenido propio.

En este momento solo carga información sobre la organización "Sarasa Inc.", dicha información es `equipos` (nombre, participantes y aplicaciones que tienen a cargo) y `aplicaciones` (nombre y descripción), las preguntas deben ser relacionadas con esta data

Se puede extender el conocimiento del chat agregando más documentos y volviendo a cargarlos en la base (se recomienda vaciar la base antes para no tener documentos duplicados)
